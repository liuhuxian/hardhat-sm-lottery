const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config");
const { verify } = require("../utils/verify");

const VRF_SUB_FUND_AMOUNT = ethers.parseUnits("30");

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    log(`chainid :${chainId}`);
    let vrfCoordinatorV2Address, subscriptionId, VRFCoordinatorV2Mock_contract;

    if (developmentChains.includes(network.name)) {
        const VRFCoordinatorV2Mock_deployment = await deployments.get("VRFCoordinatorV2Mock");
        const signer = await ethers.provider.getSigner();
        VRFCoordinatorV2Mock_contract = await ethers.getContractAt(
            "VRFCoordinatorV2Mock",
            VRFCoordinatorV2Mock_deployment.address,
            signer,
        );
        vrfCoordinatorV2Address = VRFCoordinatorV2Mock_contract.target;

        const transactionResponse = await VRFCoordinatorV2Mock_contract.createSubscription();
        const transactionReceipt = await transactionResponse.wait(1);
        subscriptionId = transactionReceipt.logs[0].args[0];

        await VRFCoordinatorV2Mock_contract.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT);
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const entranceFee = networkConfig[chainId]["entranceFee"];
    const gasLane = networkConfig[chainId]["gasLane"];
    const callbackGasLimit = networkConfig[chainId]["callbackGasLimit"];
    const interval = networkConfig[chainId]["interval"];
    const args = [
        vrfCoordinatorV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];
    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    });
    log("Raffle deployed!!");

    if (developmentChains.includes(network.name)) {
        await VRFCoordinatorV2Mock_contract.addConsumer(subscriptionId, raffle.address);
    }

    if (!developmentChains.includes(network.name) && process.env.ETHERVERIFY_API_KEY) {
        //VERIFY
        log("Start verifing");
        await verify(raffle.address, args);
    }
    log("---------------------------------------------------------");
};

module.exports.tags = ["all", "raffle"];
