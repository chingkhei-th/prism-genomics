import "dotenv/config";
import "@nomicfoundation/hardhat-viem";
import hardhatViemPlugin from "@nomicfoundation/hardhat-viem";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";
import hardhatIgnitionViem from "@nomicfoundation/hardhat-ignition-viem";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [
    hardhatViemPlugin,
    hardhatMocha,
    hardhatIgnitionViem,
    hardhatNetworkHelpers,
    hardhatKeystore,
  ],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    localhost: {
      type: "http",
      chainType: "l1",
      url: "http://127.0.0.1:8545",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: process.env.SEPOLIA_RPC_URL ?? "",
      accounts: process.env.PRIVATE_KEY?.match(/^[0-9a-fA-F]{64}$/)
        ? [process.env.PRIVATE_KEY]
        : [],
    },
  },
});
