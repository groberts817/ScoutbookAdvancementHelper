chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  console.log(tab.url)
  console.log(changeInfo.status)
  if (
    changeInfo.status === "complete" &&
    tab.url &&
    tab.url.startsWith("https://scoutbook.scouting.org/mobile/dashboard/admin/advancement/rank.asp")
  ) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ["content-script.js"]
    });
  }
});