import { Connection, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  TokenAccount,
  SPL_ACCOUNT_LAYOUT,
  LIQUIDITY_STATE_LAYOUT_V4,
} from "@raydium-io/raydium-sdk";

import { OpenOrders } from "@project-serum/serum";

import BN from "bn.js";

const OPENBOOK_PROGRAM_ID = new PublicKey(
  "srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX"
);

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
  const connection = new Connection(process.argv[2], "confirmed");
  const owner = new PublicKey("VnxDzsZ7chE88e9rB6UKztCt2HUwrkgCTx8WieWf5mM");
  
  let poolId : String;

  if (process.argv.length > 3){
    poolId = process.argv[3];
  }
  else {
    poolId = "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2";
  }  

  const tokenAccounts = await getTokenAccounts(connection, owner);

  // example to get pool info
  const info = await connection.getAccountInfo(new PublicKey(poolId));
  if (!info) return;

  const poolState = LIQUIDITY_STATE_LAYOUT_V4.decode(info.data);

  const openOrders = await OpenOrders.load(
    connection,
    poolState.openOrders,
    OPENBOOK_PROGRAM_ID // OPENBOOK_PROGRAM_ID(marketProgramId) of each pool can get from api: https://api.raydium.io/v2/sdk/liquidity/mainnet.json
  );  

  const baseTokenAmount = await connection.getTokenAccountBalance(
    poolState.baseVault
  );
  const quoteTokenAmount = await connection.getTokenAccountBalance(
    poolState.quoteVault
  );

  const basePnl = poolState.baseNeedTakePnl.toNumber();
  const quotePnl = poolState.quoteNeedTakePnl.toNumber();

  const openOrdersBaseTokenTotal =
    openOrders.baseTokenTotal.toNumber();
  const openOrdersQuoteTokenTotal =
    openOrders.quoteTokenTotal.toNumber();

  const base = parseInt(baseTokenAmount.value.amount) + openOrdersBaseTokenTotal - basePnl;
  const quote = parseInt(quoteTokenAmount.value.amount) + openOrdersQuoteTokenTotal - quotePnl;

  let out = {
    "token_account_ids": [poolState.baseMint, poolState.quoteMint],
    "amounts": [base, quote],
    "decimals": [poolState.baseDecimal.toNumber(), poolState.quoteDecimal.toNumber()]
  }

  console.log("%j", out);
}

parsePoolInfo();