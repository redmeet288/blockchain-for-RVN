import readline from 'readline';
import { RvnCoinService, TransactionParams } from './coin.service';
import { number } from 'bitcoinjs-lib/src/cjs/script';
import dotenv from 'dotenv';
dotenv.config();
async function main() {
  const service = new RvnCoinService();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let currentAddress = '';
  let currentPrivateKey = '';

  function question(query: string): Promise<string> {
    return new Promise(resolve => rl.question(query, resolve));
  }

  async function generateAddress() {
    const wallet = await service.addressCreate();
    console.log('Сгенерирован адрес:', wallet.address);
    console.log('Приватный ключ:', wallet.privateKey);
    const valid = service.addressValidate(wallet.address);
    console.log('Валидность адреса:', valid.valid);

    currentAddress = wallet.address;
    currentPrivateKey = wallet.privateKey;
  }

  async function makeTransaction() {
    if (!currentAddress || !currentPrivateKey) {
      console.log('Сначала установите текущий адрес и приватный ключ!');
      return;
    }

    const toAddress = await question('Введите адрес получателя: ');
    const amountStr = await question('Введите сумму для отправки: ');
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      console.log('Некорректная сумма!');
      return;
    }

    try {
      const txid = await service.txBuild({
        from: [{ address: currentAddress, value: "0" }], 
        to: [{ address: toAddress, value: amountStr }],
        fee: 0, 
      }, currentPrivateKey);
      console.log('Транзакция отправлена, TXID:', txid);
    } catch (e: any) {
      console.error('ошибка отправки транзакции:', e.message || e);
    }
  }

  async function showBalance() {
    if (!currentAddress) {
      console.log('установите текущий адрес!');
      return;
    }
    const balance = await service.getBalance(currentAddress);
    console.log(`баланс для ${currentAddress}:`, balance, 'RVN');
  }

  async function showInfoTxid() {
    try{
      const rrr = await question('введи id транзакции: ')
      const res = await service.getTxDetails(rrr)
      console.log(res);
    }
    catch(e:any){
      console.error('ошибка, не получается получить транзакцию')
    }
    
  }

  async function showBlockchainHeight() {
    const height = await service.getHeight();
    console.log('Текущая высота блокчейна:', height);
  }

  async function setCurrentWallet() {
    const addr = await question('Введите текущий адрес: ');
    const priv = await question('Введите приватный ключ: ');
    currentAddress = addr.trim();
    currentPrivateKey = priv.trim();
  }

  async function showBlockHash() {
    const number = await question('введи номер блока: ');
    const number_e = parseInt(number, 10)
    const height = await service.getBlock(number_e);
    console.log('Текущая высота блокчейна:', height);
  }

  while (true) {
    console.log('\n--------------------------');
    console.log(`Текущий адрес: ${currentAddress || '(не установлен)'}`);
    console.log('Выберите действие:');
    console.log('1. Сгенерировать адрес');
    console.log('2. Установить текущий адрес и приватный ключ');
    console.log('3. Отправить транзакцию');
    console.log('4. Показать баланс текущего адреса');
    console.log('5. Показать текущую высоту блокчейна');
    console.log('6. Получить информацию о транзакции');
    console.log('7. Получить данные о блоке');
    console.log('0. Выйти');

    const choice = await question('Введите номер: ');

    switch (choice.trim()) {
      case '1':
        await generateAddress();
        break;
      case '2':
        await setCurrentWallet();
        break;
      case '3':
        await makeTransaction();
        break;
      case '4':
        await showBalance();
        break;
      case '5':
        await showBlockchainHeight();
        break;
      case '6':
        await showInfoTxid()
        break;
      case '7':
        await showBlockHash();
        break;
      case '0':
        rl.close();
        process.exit(0);
      default:
        console.log('Некорректный выбор, попробуйте еще.');
    }
  }
}

main().catch(console.error);
