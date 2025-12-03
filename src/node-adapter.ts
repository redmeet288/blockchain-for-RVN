import axios, { AxiosInstance } from 'axios';


export class NodeAdapter {
private readonly client: AxiosInstance;


constructor(private apiKey: string, private baseUrl = 'https://rvn.nownodes.io') {
this.client = axios.create({
baseURL: baseUrl,
headers: { 'api-key': apiKey,
    'Content-Type': 'application/json'
         
 },
});
}


async getHeight(): Promise<number> {
const { data } = await this.client.post('/block/tip');
console.log(data.height);
return data.height;
}


async getBalance(address: string): Promise<number> {
const { data } = await this.client.post(`/address/${address}`);
return data.balance;
}


async getBlock(heightOrHash: string | number) {
const endpoint = typeof heightOrHash === 'number' ? `/block/${heightOrHash}` : `/block/${heightOrHash}`;
const { data } = await this.client.get(endpoint);
return data;
}


async txByHash(hash: string) {
const { data } = await this.client.get(`/tx/${hash}`);
return data;
}


async broadcastTx(rawTxHex: string) {
const { data } = await this.client.post('/tx/send', { hex: rawTxHex });
return data.txid;
}
}