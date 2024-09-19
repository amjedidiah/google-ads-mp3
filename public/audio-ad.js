// audio-ad.js
let adsManager;
let adsLoader;
let adDisplayContainer;
let intervalTimer;
let videoContent;
let adPlaying = false;
let playPromise;
let currentAdTagIndex = 0;

const adTagUrls = [
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=",
  "https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=",
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=",
];

function initializeIMA() {
  console.log("Initializing IMA");
  videoContent = document.getElementById("contentPlayer");
  adDisplayContainer = new google.ima.AdDisplayContainer(
    document.getElementById("adContainer"),
    videoContent
  );
  adsLoader = new google.ima.AdsLoader(adDisplayContainer);
  adsLoader.addEventListener(
    google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
    onAdsManagerLoaded,
    false
  );
  adsLoader.addEventListener(
    google.ima.AdErrorEvent.Type.AD_ERROR,
    onAdError,
    false
  );
}

function requestAds(adType) {
  console.log(`Requesting ${adType} ad, using tag index ${currentAdTagIndex}`);
  var adsRequest = new google.ima.AdsRequest();

  adsRequest.adTagUrl = adTagUrls[currentAdTagIndex];

  // Add a timestamp to prevent caching
  adsRequest.adTagUrl += "&correlator=" + Date.now();

  adsRequest.linearAdSlotWidth = 640;
  adsRequest.linearAdSlotHeight = 400;

  // Specify the ad type in the tag URL
  adsRequest.adTagUrl += "&ad_type=" + adType;

  console.log("Using ad tag URL:", adsRequest.adTagUrl);

  adsLoader.requestAds(adsRequest);
}

function onAdsManagerLoaded(adsManagerLoadedEvent) {
  console.log("Ads Manager Loaded");
  var adsRenderingSettings = new google.ima.AdsRenderingSettings();
  adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
  adsManager = adsManagerLoadedEvent.getAdsManager(
    videoContent,
    adsRenderingSettings
  );

  adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, onAdError);
  adsManager.addEventListener(
    google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
    onContentPauseRequested
  );
  adsManager.addEventListener(
    google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
    onContentResumeRequested
  );
  adsManager.addEventListener(
    google.ima.AdEvent.Type.ALL_ADS_COMPLETED,
    onAdEvent
  );
  adsManager.addEventListener(google.ima.AdEvent.Type.LOADED, onAdEvent);
  adsManager.addEventListener(google.ima.AdEvent.Type.STARTED, onAdEvent);
  adsManager.addEventListener(google.ima.AdEvent.Type.COMPLETE, onAdEvent);

  playAds();
}

function playAds() {
  console.log("Playing ads");
  videoContent.pause();
  adDisplayContainer.initialize();
  try {
    adsManager.init(640, 360, google.ima.ViewMode.NORMAL);
    adsManager.start();
    adPlaying = true;
  } catch (adError) {
    console.log("AdsManager could not be started", adError);
    onAdError(adError);
  }
}

function onAdEvent(adEvent) {
  console.log("Ad event:", adEvent.type);
  var ad = adEvent.getAd();
  switch (adEvent.type) {
    case google.ima.AdEvent.Type.LOADED:
      console.log("Ad loaded");
      if (!ad.isLinear()) {
        resumeContent();
      }
      break;
    case google.ima.AdEvent.Type.STARTED:
      console.log("Ad started");
      if (ad.isLinear()) {
        intervalTimer = setInterval(function () {
          var remainingTime = adsManager.getRemainingTime();
          console.log("Ad remaining time:", remainingTime);
        }, 300);
      }
      break;
    case google.ima.AdEvent.Type.COMPLETE:
      console.log("Ad completed");
      adPlaying = false;
      if (ad.isLinear()) {
        clearInterval(intervalTimer);
      }
      resumeContent();
      break;
  }
}

function onAdError(adErrorEvent) {
  console.log("Ad error:", adErrorEvent.getError());
  console.log("Error type:", adErrorEvent.getError().getType());
  console.log("Error code:", adErrorEvent.getError().getVastErrorCode());
  console.log("Error message:", adErrorEvent.getError().getMessage());
  if (adsManager) {
    adsManager.destroy();
  }
  adPlaying = false;

  // Move to the next ad tag
  currentAdTagIndex = (currentAdTagIndex + 1) % adTagUrls.length;

  if (currentAdTagIndex !== 0) {
    // If we haven't tried all ad tags yet, try the next one
    console.log(`Trying next ad tag, index ${currentAdTagIndex}`);
    requestAds("retry");
  } else {
    // If we've tried all ad tags, resume content
    console.log("All ad tags attempted, resuming content");
    resumeContent();
  }
}

function onContentPauseRequested() {
  console.log("Content pause requested");
  videoContent.pause();
}

function onContentResumeRequested() {
  console.log("Content resume requested");
  adPlaying = false;
  resumeContent();
}

function resumeContent() {
  console.log("Resuming content");
  if (!videoContent.ended) {
    videoContent.play();
  } else {
    console.log("Content playback complete");
  }
}

function setupEventListeners() {
  videoContent.addEventListener("play", function (event) {
    console.log("Play event triggered");
    if (!adPlaying && videoContent.currentTime === 0) {
      event.preventDefault();
      currentAdTagIndex = 0; // Reset to first ad tag for each new play attempt
      requestAds("pre-roll");
    }
  });

  videoContent.addEventListener("pause", function (event) {
    console.log("Pause event triggered");
    if (adsManager && adPlaying) {
      adsManager.pause();
    }
  });

  videoContent.addEventListener("ended", function (event) {
    console.log("Content ended");
    currentAdTagIndex = 0; // Reset to first ad tag for post-roll
    requestAds("post-roll");
  });
}

window.addEventListener("load", function () {
  console.log("Window loaded");
  videoContent = document.getElementById("contentPlayer");
  setupEventListeners();
  initializeIMA();
});
