import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PrismGenomicsModule", (m) => {
  // Deploy the PatientRegistry contract
  const patientRegistry = m.contract("PatientRegistry");

  // Deploy the DataAccess contract, passing the PatientRegistry address as an argument
  const dataAccess = m.contract("DataAccess", [patientRegistry]);

  return { patientRegistry, dataAccess };
});
