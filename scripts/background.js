import { encrypt, hash } from './helpers/cipher';
import {
  AUTHENTICATED,
  ONBOARDING_COMPLETE,
  PASSWORD,
  WALLET,
} from './helpers/constants';
import { addListener } from './helpers/message';
import { setLocalValue, setSessionValue } from './helpers/storage';
import {
  generateAddress,
  generateChild,
  generatePhrase,
  generateRoot,
} from './helpers/wallet';

const constants = require('dogecoin-bip84/src/constants');
const networks = require('bitcoinjs-lib/src/networks');

// Hack bitcoinjs-lib values to use the dogecoin values from bip84
networks.dogecoin = { ...constants.NETWORKS.mainnet };
networks.dogecoin.wif = networks.bitcoin.wif;

// onRequestTransaction: Launch notification popup
function onRequestTransaction({ data = {}, sendResponse } = {}) {
  chrome.windows.getCurrent((w) => {
    const width = 360;
    const height = 540;
    chrome.windows.create(
      {
        url: `notification.html?amount=${data.amount}`,
        type: 'popup',
        width,
        height,
        left: w.width + w.left - width,
        top: w.top,
      },
      (newWindow) => {
        console.log(
          `can use ${newWindow.id} to set up listener for transaction success/fail maybe?`
        );
        if (sendResponse) sendResponse('success');
      }
    );
  });
}

// Generates a seed phrase, root keypair, child keypair + address 0
// Encrypt + store the private data and address
async function onCreateWallet({ data = {}, sendResponse = () => {} } = {}) {
  if (data.password) {
    const phrase = generatePhrase();
    const root = generateRoot(phrase);
    const child = generateChild(root, 0);
    const address0 = generateAddress(child);

    const wallet = {
      phrase,
      root: root.toWIF(),
      child: child.toWIF(),
      addresses: [address0],
    };

    const encryptedPassword = encrypt({
      data: hash(data.password),
      password: data.password,
    });
    const encryptedWallet = encrypt({
      data: wallet,
      password: data.password,
    });

    Promise.all([
      await setLocalValue({
        [PASSWORD]: encryptedPassword,
        [WALLET]: encryptedWallet,
        [ONBOARDING_COMPLETE]: true,
      }),
      await setSessionValue({ [AUTHENTICATED]: true }),
    ])
      .then(() => {
        sendResponse(true);
      })
      .catch(() => sendResponse(false));
  }
  return true;
}

export const messageHandler = ({ message, data }, sender, sendResponse) => {
  if (!message) return;
  switch (message) {
    case 'requestTransaction':
      onRequestTransaction({ data, sendResponse });
      break;
    case 'createWallet':
      onCreateWallet({ data, sendResponse });
      break;
    default:
  }
};

// Listen for messages from the popup
addListener(messageHandler);
