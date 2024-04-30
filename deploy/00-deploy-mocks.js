const { network, ethers } = require("hardhat");
// const {} = require("hardhat-ethers");
// const {} = require("ethers");
const { developmentChains } = require("../helper-hardhat-config");

const BASE_FEE = ethers.parseUnits("0.25"); //0.25 is the premium.It cost 0.25 LINK
const GAS_PRICE_LINK = 1e9;

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    if (developmentChains.includes(network.name)) {
        log("Local network detected!Deploying mocks...");
        await deploy("VRFCoordinatorV2Mock", {
            contract: "VRFCoordinatorV2Mock",
            from: deployer,
            log: true,
            args: [BASE_FEE, GAS_PRICE_LINK],
        });
        log("Mocks deployed");
        log("-----------------------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
