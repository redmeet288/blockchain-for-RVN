import * as bip39 from 'bip39';
import { Psbt, payments, address as btcAddress } from 'bitcoinjs-lib';
import { BIP32Factory } from 'bip32';
import ECPairFactory from 'ecpair';
import * as tinysecp from 'tiny-secp256k1';
import axios from 'axios';
import Big from 'big.js';
import dotenv from 'dotenv';
dotenv.config();

const bip32 = BIP32Factory(tinysecp);
const ECPair = ECPairFactory(tinysecp);
const RavencoinRPC = require("@ravenrebels/ravencoin-rpc");


export const RVN_NETWORK = {
  messagePrefix: '\x18Raven Signed Message:\n',
  bech32: 'rvn',
  bip32: { public: 0x0488b21e, private: 0x0488ade4 },
  pubKeyHash: 0x3c,
  scriptHash: 0x7a,
  wif: 0x80,
};

export interface AddressCreateResult {
  mnemonic: string;
  address: string;
  privateKey: string;
  publicKey: string;
}

export interface AddressValidateResult {
  valid: boolean;
}

export interface UTXO {
  txid: string;
  vout: number;
  amount: number;
  scriptPubKey?: string;
}

export interface TransactionParams {
  from: { address: string; value: string }[];
  to: { address: string; value: string }[];
  fee: number;
}

export interface TxSignResult {
  hex: string;
}


export class RvnCoinService {
  private readonly baseUrl = 'https://rvn.nownodes.io';
  private readonly apiKey = process.env.NOWNODES_API_KEY;
  private readonly rave = RavencoinRPC.getRPC("GH", "HGF", "https://rvn-rpc-mainnet.ting.finance/rpc");



  async addressCreate(): Promise<AddressCreateResult> {
    const mnemonic = bip39.generateMnemonic();
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const root = bip32.fromSeed(seed, RVN_NETWORK);
    const child = root.derivePath("m/44'/175'/0'/0/0");


    const { address } = payments.p2pkh({
      pubkey: child.publicKey,
      network: RVN_NETWORK,
    });

    return {
      mnemonic,
      address: address!,
      privateKey: child.toWIF(),
      publicKey: Buffer.from(child.publicKey).toString('hex'),
    };
  }

  
  addressValidate(address: string): AddressValidateResult {
    try {
      btcAddress.toOutputScript(address, RVN_NETWORK);
      return { valid: true };
    } catch {
      return { valid: false };
    }
  }



  public async rpc(method: string, params: any[] = []) {
    const response = await axios.post(
      this.baseUrl,
      {
        jsonrpc: '1.0',
        id: 'rvn',
        method,
        params,
      },
      {
        headers: {
          'api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.error) {
      throw new Error(
        `RPC error: ${response.data.error.code} ${response.data.error.message}`
      );
    }

    return response.data.result;
  }

  async getHeight(): Promise<number> {
    try {
      return await this.rpc('getblockcount');  
    } catch (e: any) {
      console.warn('NowNodes не работает:', e.message);
      return await this.rave('getblockcount');  
    }
  }
  async getTxDetails(txid: string) {
    try {
      const rawTx = await this.rave('getrawtransaction', [txid, true]); 
      const decoded = await this.rave('decoderawtransaction', [rawTx.hex]);
      console.log('TX детали:', {
        confirmations: rawTx.confirmations,
        fee: rawTx.fee,
        vout: decoded.vout  
      });
      return rawTx;
    } catch (e) {
      console.error('TX не найдена:', e.message);
    }
  }

  

  async getBalance(address) {
  try {
    const result = await this.rave("getaddressbalance", [
      { addresses: [address] }
    ]);

    const rvn = result.balance / 100000000;
    console.log("Balance:", rvn);
    return rvn;
  } catch (err) {
    console.log("ERR:", err);
  }
}
  

  async getBlock(blockNumber: number): Promise<any> {
    const hash = await this.rave('getblockhash', [blockNumber]);
    return await this.rave('getblock', [hash]);
  }


  async getUtxo(address: string): Promise<UTXO[]> {
    console.log('Запрос UTXO для адреса:', address);
    try{
      const params = [{addresses: [address]}];
      const utxos = await this.rave('getaddressutxos', [address]);
      console.log('UTXOs:', utxos);
      if (!utxos || utxos.length === 0) {
        throw new Error('Нет UTXO для адреса');
      }

      return utxos.map((u: any) => ({
        txid: u.txid,
        vout: u.outputIndex,
        amount: u.satoshis / 100000000,
        scriptPubKey: u.script,
    }));
    }
    catch (e: any) {
        console.error('Ошибка getaddressutxos:', e.response?.data || e.message);
        return [];
    }
    
  }

  async txByHash(txid: string): Promise<any> {
    const raw = await this.rave('getrawtransaction', [txid]);
    const decoded = await this.rave('decoderawtransaction', [raw]);

    return { hex: raw, decoded };
  }


  async txBuild(params: TransactionParams, privateKey: string): Promise<InstanceType<typeof Psbt>> {
  console.log('сборка транзакции...');
  
  const allUtxos: UTXO[] = [];
  let totalInput = 0;
  for (const input of params.from) {
    const utxos = await this.getUtxo(input.address);
    allUtxos.push(...utxos);
    totalInput += utxos.reduce((sum, u) => sum + u.amount, 0);
  }


   const sendAmount = params.to.reduce((sum, o) => sum + parseFloat(o.value), 0);
  
  const estimatedFee = 0.00005; 
  
  if (totalInput < sendAmount + estimatedFee) {
    throw new Error(`Недостаточно: нужно ${sendAmount + estimatedFee}, есть ${totalInput}`);
  }
  
  const outputs: Record<string, number> = {};
  for (const output of params.to) {
    outputs[output.address] = parseFloat(output.value);
  }
  
  const changeAmount = totalInput - sendAmount - estimatedFee;
  if (changeAmount > 0.00001) { 
    const changeAddress = params.from[0].address;
    outputs[changeAddress] = changeAmount;
    console.log(`Сдача: ${changeAmount.toFixed(8)} RVN → ${changeAddress}`);
  }
  
  console.log(`Входы: ${totalInput.toFixed(8)} RVN`);
  console.log(`Отправка: ${sendAmount.toFixed(8)} RVN`);
  console.log(`Fee: ${estimatedFee.toFixed(8)} RVN`);
  const inputs = allUtxos.map(u => ({ txid: u.txid, vout: u.vout }));

  const rawTx = await this.rave('createrawtransaction', [inputs, outputs]);
  console.log('RPC rawTx:', rawTx);

  const signed = await this.rave('signrawtransaction', [rawTx, null, [privateKey]]);
  console.log('Signed:', signed);
  
  if (!signed.complete) {
    throw new Error(`Не подписана: ${JSON.stringify(signed.errors)}`);
  }

  const txid = await this.rave('sendrawtransaction', [signed.hex]);
  console.log('TXID:', txid);
  
  return txid;
}


  // async txSign(psbt: InstanceType<typeof Psbt>, keyPairs: Record<string, string>): Promise<TxSignResult> {
  //   const address = Object.keys(keyPairs)[0];
  //   const wif = keyPairs[address];

  //   const keyPair = ECPair.fromWIF(wif, RVN_NETWORK);

  //   psbt.signAllInputs(keyPair);
  //   psbt.finalizeAllInputs();

  //   return { hex: psbt.extractTransaction().toHex() };
  // }
}
