import { expect } from "chai";
import hre from "hardhat";

describe("PatientRegistry", function () {
  async function deployPatientRegistryFixture() {
    const connection = await hre.network.connect();
    const publicClient = await connection.viem.getPublicClient();
    const [owner, patient1, nonPatient] = await connection.viem.getWalletClients();
    const registry = await connection.viem.deployContract("PatientRegistry");

    return { registry, owner, patient1, nonPatient, publicClient };
  }

  describe("Registration", function () {
    it("Should allow a patient to register", async function () {
      const { registry, patient1, publicClient } = await deployPatientRegistryFixture();

      const hash = await registry.write.register({ account: patient1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");

      const isRegistered = await registry.read.isPatient([patient1.account.address]);
      expect(isRegistered).to.be.true;
    });

    it("Should not allow dual registration", async function () {
      const { registry, patient1 } = await deployPatientRegistryFixture();

      await registry.write.register({ account: patient1.account });

      try {
        await registry.write.register({ account: patient1.account });
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Patient already registered");
      }
    });

    it("Should correctly report unregistered patients", async function () {
      const { registry, nonPatient } = await deployPatientRegistryFixture();

      const isRegistered = await registry.read.isPatient([nonPatient.account.address]);
      expect(isRegistered).to.be.false;
    });
  });
});
