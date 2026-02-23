// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract PatientRegistry {
    struct Patient {
        bool isRegistered;
        uint256 registeredAt;
    }

    mapping(address => Patient) public patients;

    event PatientRegistered(address indexed patientAddress, uint256 timestamp);

    modifier onlyRegistered() {
        require(patients[msg.sender].isRegistered, "Patient not registered");
        _;
    }

    function register() external {
        require(!patients[msg.sender].isRegistered, "Patient already registered");
        
        patients[msg.sender] = Patient({
            isRegistered: true,
            registeredAt: block.timestamp
        });

        emit PatientRegistered(msg.sender, block.timestamp);
    }

    function isPatient(address _patient) external view returns (bool) {
        return patients[_patient].isRegistered;
    }
}
