// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PatientRegistry.sol";

contract DataAccess {
    PatientRegistry public patientRegistry;

    enum AccessStatus {
        None,
        Requested,
        Approved,
        Revoked
    }

    struct GenomicData {
        string ipfsCid;
        string blake3Hash; // Stores the tamper-proof fingerprint
        bool exists;
    }

    struct AccessRequest {
        AccessStatus status;
        uint256 timestamp;
    }

    // Patient => Doctor => AccessRequest
    mapping(address => mapping(address => AccessRequest)) public permissions;
    
    // Patient => GenomicData
    mapping(address => GenomicData) public patientData;

    event DataUploaded(address indexed patient, string ipfsCid, string blake3Hash);
    event AccessRequested(address indexed doctor, address indexed patient);
    event AccessApproved(address indexed patient, address indexed doctor);
    event AccessRevoked(address indexed patient, address indexed doctor);

    constructor(address _patientRegistryAddress) {
        patientRegistry = PatientRegistry(_patientRegistryAddress);
    }

    modifier onlyRegisteredPatient() {
        require(patientRegistry.isPatient(msg.sender), "Not a registered patient");
        _;
    }

    // Patient uploads their encrypted data hashes (0 raw data)
    function uploadData(string memory _ipfsCid, string memory _blake3Hash) external onlyRegisteredPatient {
        patientData[msg.sender] = GenomicData({
            ipfsCid: _ipfsCid,
            blake3Hash: _blake3Hash,
            exists: true
        });

        emit DataUploaded(msg.sender, _ipfsCid, _blake3Hash);
    }

    // Doctor requests access to a patient's data
    function requestAccess(address _patient) external {
        require(patientData[_patient].exists, "Patient has no data uploaded");
        require(permissions[_patient][msg.sender].status != AccessStatus.Approved, "Access already approved");

        permissions[_patient][msg.sender] = AccessRequest({
            status: AccessStatus.Requested,
            timestamp: block.timestamp
        });

        emit AccessRequested(msg.sender, _patient);
    }

    // Patient approves a doctor's request
    function approveAccess(address _doctor) external onlyRegisteredPatient {
        require(permissions[msg.sender][_doctor].status == AccessStatus.Requested, "No pending request from this doctor");

        permissions[msg.sender][_doctor].status = AccessStatus.Approved;
        permissions[msg.sender][_doctor].timestamp = block.timestamp;

        emit AccessApproved(msg.sender, _doctor);
    }

    // Patient revokes a doctor's access
    function revokeAccess(address _doctor) external onlyRegisteredPatient {
        require(permissions[msg.sender][_doctor].status == AccessStatus.Approved, "Doctor does not have approved access");

        permissions[msg.sender][_doctor].status = AccessStatus.Revoked;
        permissions[msg.sender][_doctor].timestamp = block.timestamp;

        emit AccessRevoked(msg.sender, _doctor);
    }

    // Helper for doctor/system to check if access is granted
    function checkAccess(address _patient, address _doctor) external view returns (bool) {
        return permissions[_patient][_doctor].status == AccessStatus.Approved;
    }

    // Get the patient's data only if the caller has approved access or is the patient themselves
    function getGenomicData(address _patient) external view returns (string memory ipfsCid, string memory blake3Hash) {
        require(
            msg.sender == _patient || permissions[_patient][msg.sender].status == AccessStatus.Approved,
            "Not authorized to view data"
        );

        GenomicData memory data = patientData[_patient];
        return (data.ipfsCid, data.blake3Hash);
    }
}
