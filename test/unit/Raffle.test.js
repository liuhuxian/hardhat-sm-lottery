const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");
const { assert, expect } = require("chai");
const { HARDHAT_EXECUTABLE_NAME } = require("hardhat/internal/constants");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("[TEST]Raffle Contract", function () {
          let raffle, vrfCoordinatorV2, raffleEntranceFee, deployer, interval;
          provider = ethers.provider;
          const chainId = network.config.chainId;

          beforeEach(async () => {
              const signer = await provider.getSigner();
              deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture("all");

              raffle_deployment = await deployments.get("Raffle");
              raffle = await ethers.getContractAt("Raffle", raffle_deployment.address, signer);
              vrfCoordinatorV2_deployment = await deployments.get("VRFCoordinatorV2Mock");
              vrfCoordinatorV2 = await ethers.getContractAt(
                  "VRFCoordinatorV2Mock",
                  vrfCoordinatorV2_deployment.address,
                  signer,
              );
              raffleEntranceFee = await raffle.getEntranceFee();
              interval = await raffle.getInterval();
          });

          describe("constructor", () => {
              it("initializes the raffle correctly", async () => {
                  const raffleState = await raffle.getRaffleState();
                  /**make sure the evaluation in the constructor is correct */
                  assert.equal(raffleState.toString(), "0");
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"]);
              });
          });

          describe("enterRaffle", () => {
              it("reverts when you don't pay enough", async () => {
                  await expect(raffle.enterRaffle()).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__NotEnoughETHEntered",
                  );
              });
              it("records players when they enter", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  const playerFromContract = await raffle.getPlayer(0);
                  assert.equal(playerFromContract, deployer);
              });
              it("emits event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: raffleEntranceFee })).to.emit(
                      raffle,
                      "RaffleEnter",
                  );
              });
              it("doesn't allow entrance when raffle is calculating", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");

                  await expect(
                      raffle.enterRaffle({ value: raffleEntranceFee }),
                  ).to.be.revertedWithCustomError(raffle, "Raffle__NotOpen");
              });
          });

          describe("checkUpkeep", () => {
              it("returns false if people haven't sent any eth", async () => {
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });
              it("returns false if raffle isn't open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  await raffle.performUpkeep("0x");
                  const raffleState = await raffle.getRaffleState();
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert.equal(raffleState.toString(), "1");
                  assert.equal(upkeepNeeded, false);
              });
              it("return false if enough time isn't passed", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval - 5n).toString()]);
                  await provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players,eth,and is open", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(upkeepNeeded);
              });
          });

          describe("performUpkeep", () => {
              it("it can only run if checkupkeep is true", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  const { upkeepNeeded } = await raffle.checkUpkeep("0x");
                  assert(upkeepNeeded);
                  const tx = await raffle.performUpkeep("0x");
                  assert(tx);
              });
              it("reverts if checkup is false", async () => {
                  await expect(raffle.performUpkeep("0x")).to.be.revertedWithCustomError(
                      raffle,
                      "Raffle__UpkeepNotNeeded",
                  );
              });
              it("updates the raffle state and emits a requestId", async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
                  const txResponse = await raffle.performUpkeep("0x");
                  const txReceipt = await txResponse.wait(1);
                  const requestId = txReceipt.logs[1].args[0];
                  const raffleState = await raffle.getRaffleState();
                  assert(requestId > 0);
                  assert(raffleState == 1);
              });
          });
          describe("fulfilRandomWords", () => {
              beforeEach(async () => {
                  await raffle.enterRaffle({ value: raffleEntranceFee });
                  await provider.send("evm_increaseTime", [(interval + 1n).toString()]);
                  await provider.send("evm_mine", []);
              });
              it("it can only be called after performUpkeep", async () => {
                  await expect(vrfCoordinatorV2.fulfillRandomWords(0, raffle.target)).to.be
                      .reverted;
                  await expect(vrfCoordinatorV2.fulfillRandomWords(1, raffle.target)).to.be
                      .reverted;
              });

              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrants_num = 3;
                  const additioncalentrants_startIndex = 1;
                  const accounts = await ethers.getSigners();
                  for (
                      let i = additioncalentrants_startIndex;
                      i < additioncalentrants_startIndex + additionalEntrants_num;
                      i++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[i]);
                      await accountConnectedRaffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimestamp = await raffle.getLatestTimestamp();

                  await new Promise(async (resolve, reject) => {
                      setTimeout(resolve, 10000);
                      raffle.once("Winnerpicked", async () => {
                          console.log("Found the event");

                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              console.log("recentWinner:", recentWinner);
                              console.log(accounts[0].address);
                              console.log(accounts[1].address);
                              console.log(accounts[2].address);
                              console.log(accounts[3].address);
                              const raffleState = await raffle.getRaffleState();
                              const endingTimeStamp = await raffle.getLatestTimestamp();
                              const numPlayers = await raffle.getNumberOfPlayers();
                              assert(numPlayers.toString(), "0");
                              assert(raffleState.toString(), "0");
                              assert(endingTimeStamp > startingTimestamp);
                          } catch (e) {
                              reject(e);
                          }
                          resolve();
                      });

                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);

                      const requestId = txReceipt.logs[1].args[0];
                      await vrfCoordinatorV2.fulfillRandomWords(requestId, raffle.target);
                  });
              });
          });
      });
