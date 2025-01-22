console.log("starknet", window.starknet_braavos)
const payload = { starknet_braavos: "", starknet_argentx: "" }
if (window.starknet_argentx) {
  payload.starknet_argentx = window.starknet_argentx
}
if (window.starknet_braavos) {
  payload.starknet_braavos = window.starknet_braavos
}

window.postMessage({ type: "FROM_PAGE", payload: JSON.stringify(payload) }, "*");
