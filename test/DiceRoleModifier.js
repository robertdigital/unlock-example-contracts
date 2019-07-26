const { constants, protocols } = require("hardlydifficult-test-helpers");
const BigNumber = require("bignumber.js");

const DiceRoleModifier = artifacts.require("DiceRoleModifier");

contract("DiceRoleModifier", accounts => {
  const lockOwner = accounts[0];
  const keyOwner = accounts[1];
  const nonKeyOwner = accounts[2];
  let lock;
  let featureContract;

  beforeEach(async () => {
    const unlockOwner = accounts[9];
    const unlockProtocol = await protocols.unlock.deploy(web3, unlockOwner);
    const tx = await unlockProtocol.methods
      .createLock(
        60 * 60 * 24, // expirationDuration (in seconds) of 1 day
        web3.utils.padLeft(0, 40), // tokenAddress for ETH
        web3.utils.toWei("0.01", "ether"), // keyPrice
        100, // maxNumberOfKeys
        "Test Lock" // lockName
      )
      .send({
        from: lockOwner,
        gas: constants.MAX_GAS
      });

    lock = protocols.unlock.getLock(
      tx.events.NewLock.returnValues.newLockAddress
    );

    // Buy a key from the `keyOwner` account
    await lock.methods.purchaseFor(keyOwner).send({
      from: keyOwner,
      value: await lock.methods.keyPrice().call(),
      gas: constants.MAX_GAS
    });

    featureContract = await DiceRoleModifier.new(lock._address);
  });

  it("Key owner always rolls 3-22 (inclusive)", async () => {
    for (let i = 0; i < 100; i++) {
      const tx = await featureContract.rollDie({
        from: keyOwner
      });
      const lastRoll = new BigNumber(tx.receipt.logs[0].args.value);
      assert(lastRoll.gte(3));
      assert(lastRoll.lte(22));
    }
  });

  it("All other accounts roll 1-20 (inclusive)", async () => {
    for (let i = 0; i < 100; i++) {
      const tx = await featureContract.rollDie({
        from: nonKeyOwner
      });
      const lastRoll = new BigNumber(tx.receipt.logs[0].args.value);
      assert(lastRoll.gte(1));
      assert(lastRoll.lte(20));
    }
  });
});
