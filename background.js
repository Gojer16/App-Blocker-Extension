chrome.declarativeNetRequest.updateDynamicRules(
    {
      addRules: [
        {
          id: 1,
          priority: 1,
          action: { type: "block" },
          condition: {
            urlFilter: ["pornhub.com", "porndish.com"],
            resourceTypes: ["main_frame"]
          }
        }
      ],
      removeRuleIds: [1]
    },
    () => {
      console.log("Blocking rule applied!");
    }
  );
  