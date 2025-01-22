console.log('Background script initiated')

chrome.runtime.onInstalled.addListener(() => {
  console.log('onInstalled listener handler 11')
  // console.log('starknet', window.starknet_argentX)
})
