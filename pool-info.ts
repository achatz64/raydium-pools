import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  LIQUIDITY_STATE_LAYOUT_V4,
} from "@raydium-io/raydium-sdk";

import BN from "bn.js";


async function getTokenAccounts(connection: Connection, owner: PublicKey) {
  const tokenResp = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  const accounts: TokenAccount[] = [];
  for (const { pubkey, account } of tokenResp.value) {
    accounts.push({
      pubkey,
      accountInfo: SPL_ACCOUNT_LAYOUT.decode(account.data),
    });
  }

  return accounts;
}

// raydium pool id can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
//const SOL_USDC_POOL_ID = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";


export async function parsePoolInfo() {
  const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
  const owner = new PublicKey("VnxDzsZ7chE88e9rB6UKztCt2HUwrkgCTx8WieWf5mM");
  
  let poolId : String;

  if (process.argv.length > 2){
    poolId = process.argv[2];
  }
  else {
    poolId = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
  }  

  const tokenAccounts = await getTokenAccounts(connection, owner);

  // example to get pool info
  const info = await connection.getAccountInfo(new PublicKey(poolId));
  if (!info) return;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);
  

  const baseDecimal = 10 ** poolState.baseDecimal.toNumber(); // e.g. 10 ^ 6
  const quoteDecimal = 10 ** poolState.quoteDecimal.toNumber();

  const baseTokenAmount = await connection.getTokenAccountBalance(
    poolState.baseVault
  );
  const quoteTokenAmount = await connection.getTokenAccountBalance(
    poolState.quoteVault
  );

  const basePnl = poolState.baseNeedTakePnl.toNumber() / baseDecimal;
  const quotePnl = poolState.quoteNeedTakePnl.toNumber() / quoteDecimal;

  
  const denominator = new BN(10).pow(poolState.baseDecimal);

  const addedLpAccount = tokenAccounts.find((a) =>
    a.accountInfo.mint.equals(poolState.lpMint)
  );

  let spotSprice : Number = 0;

  if (quoteTokenAmount.value.uiAmount && baseTokenAmount.value.uiAmount) {
    spotSprice = quoteTokenAmount.value.uiAmount / baseTokenAmount.value.uiAmount;
  }

  let out = {
    "token_account_ids": [poolState.baseVault, poolState.quoteVault],
    "amounts": [poolState.baseNeedTakePnl.toNumber(), poolState.quoteNeedTakePnl.toNumber()],
    "decimals": [poolState.baseDecimal.toNumber(), poolState.quoteDecimal.toNumber()]
  }

  console.log("%j", out);
}

parsePoolInfo();