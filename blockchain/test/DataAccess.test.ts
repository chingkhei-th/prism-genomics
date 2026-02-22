import { expect } from "chai";
import hre from "hardhat";

describe("DataAccess", function () {
  async function deployDataAccessFixture() {
    const connection = await hre.network.connect();
    const [owner, patient1, doctor1, doctor2] = await connection.viem.getWalletClients();
    const publicClient = await connection.viem.getPublicClient();

    const registry = await connection.viem.deployContract("PatientRegistry");
    const registerHash = await registry.write.register({ account: patient1.account });
    await publicClient.waitForTransactionReceipt({ hash: registerHash });

    const dataAccess = await connection.viem.deployContract("DataAccess", [registry.address]);

    return { registry, dataAccess, owner, patient1, doctor1, doctor2, publicClient };
  }

  describe("Uploading Data", function () {
    const mockCid = "QmTestCid123456789";
    const mockBlake3 = "blake3-hash-hex";

    it("Should allow a registered patient to upload data", async function () {
      const { dataAccess, patient1, publicClient } = await deployDataAccessFixture();

      const hash = await dataAccess.write.uploadData([mockCid, mockBlake3], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const result = await dataAccess.read.getGenomicData([patient1.account.address], { account: patient1.account });

      expect(result[0]).to.equal(mockCid);
      expect(result[1]).to.equal(mockBlake3);
    });

    it("Should prevent non-patients from uploading data", async function () {
      const { dataAccess, doctor1 } = await deployDataAccessFixture();

      try {
        await dataAccess.write.uploadData([mockCid, mockBlake3], { account: doctor1.account });
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Not a registered patient");
      }
    });
  });

  describe("Access Requests", function () {
    const mockCid = "QmTestCid123456789";
    const mockBlake3 = "blake3-hash-hex";

    it("Should allow doctors to request access and patients to approve", async function () {
      const { dataAccess, patient1, doctor1, publicClient } = await deployDataAccessFixture();

      let hash = await dataAccess.write.uploadData([mockCid, mockBlake3], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await dataAccess.write.requestAccess([patient1.account.address], { account: doctor1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      let hasAccess = await dataAccess.read.checkAccess([patient1.account.address, doctor1.account.address]);
      expect(hasAccess).to.be.false;

      hash = await dataAccess.write.approveAccess([doctor1.account.address], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      hasAccess = await dataAccess.read.checkAccess([patient1.account.address, doctor1.account.address]);
      expect(hasAccess).to.be.true;

      const result = await dataAccess.read.getGenomicData([patient1.account.address], { account: doctor1.account });
      expect(result[0]).to.equal(mockCid);
      expect(result[1]).to.equal(mockBlake3);
    });

    it("Should not let unauthorized users view data", async function () {
      const { dataAccess, patient1, doctor2, publicClient } = await deployDataAccessFixture();

      const hash = await dataAccess.write.uploadData([mockCid, mockBlake3], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      try {
        await dataAccess.read.getGenomicData([patient1.account.address], { account: doctor2.account });
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Not authorized to view data");
      }
    });

    it("Should let patients revoke access", async function () {
      const { dataAccess, patient1, doctor1, publicClient } = await deployDataAccessFixture();

      let hash = await dataAccess.write.uploadData([mockCid, mockBlake3], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await dataAccess.write.requestAccess([patient1.account.address], { account: doctor1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await dataAccess.write.approveAccess([doctor1.account.address], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await dataAccess.write.revokeAccess([doctor1.account.address], { account: patient1.account });
      await publicClient.waitForTransactionReceipt({ hash });

      const hasAccess = await dataAccess.read.checkAccess([patient1.account.address, doctor1.account.address]);
      expect(hasAccess).to.be.false;

      try {
        await dataAccess.read.getGenomicData([patient1.account.address], { account: doctor1.account });
        expect.fail("Should have reverted");
      } catch (error: any) {
        expect(error.message).to.include("Not authorized to view data");
      }
    });
  });
});
