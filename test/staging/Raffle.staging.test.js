const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("[TEST]Raffle Contract", function () {
          let raffle, vrfCoordinatorV2, raffleEntranceFee, deployer, interval;
          provider = ethers.provider;
          const chainId = network.config.chainId;

          beforeEach(async () => {
              console.log("beforeeach");
              const signer = await provider.getSigner();
              deployer = (await getNamedAccounts()).deployer;
              const raffle_deployment = await deployments.get("Raffle");
              raffle = await ethers.getContractAt("Raffle", raffle_deployment.address, signer);
              raffleEntranceFee = await raffle.getEntranceFee();
          });

          describe("fulfillRandomWords", async () => {
              it("works with live sopolia chainlink keepers and chainlink vrf, we get a random winner", async () => {
                  const startingTimestamp = await raffle.getLatestTimestamp();
                  const accounts = await ethers.getSigners();

                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerWinnerpicked", async () => {
                          console.log("Winnerpicked event fired!");
                          try {
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerBalance = await accounts[0].getBalance();
                              const endingTimestamp = await raffle.getLatestTimestamp();

                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              asser.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerBalance,
                                  startingWinnerBalance + raffleEntranceFee,
                              );
                              assert(endingTimestamp > startingTimestamp);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(e);
                          }
                      });
                      console.log("Entering Raffle...");
                      const tx = await raffle.enterRaffle({ value: raffleEntranceFee });
                      console.log("Ok, time to wait...");
                      await tx.wait(1);
                      console.log("wait complete");
                      const startingWinnerBalance = await accounts[0].getBalance();
                      console.log(`balance:${startingWinnerBalance}`);
                  });
              });
          });
      });
