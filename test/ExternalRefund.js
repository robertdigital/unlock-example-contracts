const { tokens, protocols } = require("hardlydifficult-ethereum-contracts");
const truffleAssert = require("truffle-assertions");
const ExternalRefund = artifacts.require("ExternalRefund");

contract("ExternalRefund", accounts => {
  const keyOwner = accounts[2];
  let nonKeyOwner = accounts[7];
  let lock;
  let token;
  let refundingContract;
  let refundAmount = 20000;
  let whitelistedAccount = accounts[3];
  let totalMintedAmount = 9000000000;

  before(async () => {
    lock = await protocols.unlock.createTestLock(
      web3,
      accounts[9], // Unlock Protocol owner
      accounts[1], // Lock owner
      {
        keyPrice: web3.utils.toWei("0.01", "ether")
      }
    );

    // Buy a key from the `keyOwner` account
    await lock.purchaseFor(keyOwner, {
      from: keyOwner,
      value: await lock.keyPrice()
    });

    token = await tokens.sai.deploy(web3, accounts[1]);

    refundingContract = await ExternalRefund.new(
      lock.address,
      refundAmount,
      token.address
    );

    await token.mint(refundingContract.address, totalMintedAmount, {
      from: accounts[1]
    });
    await refundingContract.addWhitelisted(whitelistedAccount);
  });

  describe("refund", () => {
    describe("when the caller has not been whitelisted", async () => {
      it("reverts", async () => {
        await truffleAssert.reverts(
          refundingContract.refund(nonKeyOwner),
          "WhitelistedRole: caller does not have the Whitelisted role"
        );
      });
    });

    describe("when the caller has been whitelisted", () => {
      describe("when the recipient owns a key", () => {
        describe("when the recipient has not been refunded", () => {
          it("adds the recipient to the refunded list", async () => {
            await refundingContract.refund(keyOwner, {
              from: whitelistedAccount
            });
            assert(await refundingContract.refundee(keyOwner));
          });

          it("transfers the refund amount to the recipient", async () => {
            assert(
              (await token.balanceOf(keyOwner, {
                from: whitelistedAccount
              })) == refundAmount
            );
          });
        });

        describe("when the recipient has already been refunded", () => {
          it("reverts", async () => {
            await truffleAssert.reverts(
              refundingContract.refund(keyOwner, {
                from: whitelistedAccount
              }),
              "Recipient has already been refunded"
            );
          });
        });
      });

      describe("when the recipient doesn't own a key", () => {
        it("reverts if recipient doesnt own a key", async () => {
          await truffleAssert.reverts(
            refundingContract.refund(nonKeyOwner, {
              from: whitelistedAccount
            }),
            "Recipient does not own a key"
          );
        });
      });
    });
  });

  describe("drain", () => {
    describe("when the caller is a whitelisted admin", () => {
      it("transfers the contracts owned tokens to the caller", async () => {
        await refundingContract.drain();

        let newBalance = totalMintedAmount - refundAmount;
        assert((await token.balanceOf(accounts[0])) == newBalance);
      });
    });

    describe("when the caller is not a whitelisted admin", () => {
      it("reverts", async () => {
        await truffleAssert.reverts(
          refundingContract.drain({ from: nonKeyOwner }),
          "WhitelistAdminRole: caller does not have the WhitelistAdmin role"
        );
      });
    });
  });
});
