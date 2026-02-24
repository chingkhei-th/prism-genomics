"""
Doctor API — handles requesting data access and viewing approved patients.

Endpoints:
    POST /api/v1/doctor/request         → Ask a patient for access
    GET /api/v1/doctor/patients         → List patients who have approved access
    GET /api/v1/doctor/view/{patient}   → View a patient's risk report
"""

import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from web3 import Web3

from src.api.auth import get_current_user
from src.api.patient import _get_web3, _decrypt_private_key, DATA_ACCESS_ADDRESS, CHAIN_ID
from src.db import db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/doctor", tags=["doctor"])

class RequestAccessRequest(BaseModel):
    patient_email: str

@router.post("/request")
async def request_access(
    body: RequestAccessRequest,
    current_user=Depends(get_current_user)
):
    """
    Doctor requests access to a patient's data.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can request access")

    patient = await db.user.find_unique(where={"email": body.patient_email})
    if not patient or patient.role != "patient":
        raise HTTPException(status_code=404, detail="Patient not found")

    # Check if patient actually has data on chain/DB
    genomic_file = await db.genomicfile.find_first(
        where={"userId": patient.id},
        order={"createdAt": "desc"}
    )
    if not genomic_file:
        raise HTTPException(status_code=400, detail="Patient has not uploaded any data yet")

    # Check existing request
    existing_req = await db.accessrequest.find_first(
        where={
            "patientId": patient.id,
            "doctorId": current_user.id,
        }
    )
    if existing_req and existing_req.status == "approved":
        raise HTTPException(status_code=400, detail="Access already approved")
    
    # We do the on-chain stuff on behalf of the DOCTOR
    # Contract: function requestAccess(address _patient)
    try:
        w3 = _get_web3()
        contract = w3.eth.contract(address=DATA_ACCESS_ADDRESS, abi=[
            {
                "inputs": [{"internalType": "address", "name": "_patient", "type": "address"}],
                "name": "requestAccess",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            }
        ])

        pk = _decrypt_private_key(current_user.encryptedPrivateKey)
        account = w3.eth.account.from_key(pk)

        tx = contract.functions.requestAccess(
            Web3.to_checksum_address(patient.walletAddress)
        ).build_transaction({
            "from": account.address,
            "nonce": w3.eth.get_transaction_count(account.address),
            "gas": 200000,
            "gasPrice": w3.eth.gas_price,
            "chainId": CHAIN_ID
        })

        # Hackathon shortcut: skip explicit ETH funding strictly for the doctor if they don't have it, 
        # or we could fund them here. Let's assume the DB approach suffices for the UI if chain fails,
        # but the contract doesn't explicitly block 0 balance if gas price is zero in local dev, 
        # but Sepolia requires ETH. We will catch and log on-chain errors.
        signed_tx = w3.eth.account.sign_transaction(tx, private_key=pk)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        w3.eth.wait_for_transaction_receipt(tx_hash)
        tx_hash_hex = tx_hash.hex()

    except Exception as e:
        logger.error(f"On-chain requestAccess failed: {e}", exc_info=True)
        tx_hash_hex = None

    # Upsert the DB record
    if existing_req:
        await db.accessrequest.update(
            where={"id": existing_req.id},
            data={"status": "pending", "txHash": tx_hash_hex}
        )
    else:
        await db.accessrequest.create(
            data={
                "patientId": patient.id,
                "doctorId": current_user.id,
                "status": "pending",
                "txHash": tx_hash_hex
            }
        )

    return {"status": "success", "tx_hash": tx_hash_hex}


@router.get("/patients")
async def list_patients(current_user=Depends(get_current_user)):
    """
    List all patients who have granted this doctor "approved" access.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view patient list")

    requests = await db.accessrequest.find_many(
        where={
            "doctorId": current_user.id,
            "status": "approved"
        },
        include={"patient": True},
        order={"updatedAt": "desc"}
    )

    approved = []
    for req in requests:
        # Include a snippet of their latest data if available
        last_file = await db.genomicfile.find_first(
            where={"userId": req.patient.id},
            order={"createdAt": "desc"}
        )
        
        # We need to minimally parse the risk score if it exists
        risk_category = None
        risk_score = None
        if last_file and last_file.analysisJson:
            import json
            try:
                report = json.loads(last_file.analysisJson)
                risk_category = report.get("risk_assessment", {}).get("risk_category")
                risk_score = report.get("risk_assessment", {}).get("percentile")
                if risk_score is None:
                    # fallback
                    risk_score = report.get("ml_prediction", {}).get("disease_probability")
            except:
                pass

        approved.append({
            "address": req.patient.walletAddress,
            "email": req.patient.email,
            "name": req.patient.name,
            "approved_date": req.updatedAt.isoformat(),
            "risk_category": risk_category,
            "risk_score": risk_score,
        })

    return JSONResponse(content={"patients": approved})


@router.get("/view/{patient_address}")
async def view_patient_data(
    patient_address: str,
    current_user=Depends(get_current_user)
):
    """
    Get the full AI risk report for the patient. 
    Verifies that the doctor has an "approved" request.
    """
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Forbidden")

    patient = await db.user.find_first(where={"walletAddress": patient_address})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    access_req = await db.accessrequest.find_first(
        where={
            "patientId": patient.id,
            "doctorId": current_user.id,
            "status": "approved"
        }
    )
    if not access_req:
        raise HTTPException(status_code=403, detail="You do not have approved access")

    last_file = await db.genomicfile.find_first(
        where={"userId": patient.id},
        order={"createdAt": "desc"}
    )
    if not last_file or not last_file.analysisJson:
        raise HTTPException(status_code=404, detail="No analyzed data available")

    import json
    report = json.loads(last_file.analysisJson)
    report["cid"] = last_file.ipfsCid
    report["blake3_hash"] = last_file.blake3Hash
    return JSONResponse(content=report)
