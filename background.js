// Klick auf das Plugin-Icon öffnet das Side Panel.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error(err));
