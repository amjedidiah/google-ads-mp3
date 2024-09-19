// audio-ad.js

let adsManager;
let adsLoader;
let adDisplayContainer;
let intervalTimer;
let audioContent; // Reference to the audio player
let adPlaying = false;
let currentAdTagIndex = 0;
let currentAdType = null; // Tracks the type of the current ad ('pre-roll' or 'post-roll')

// Array of Ad Tag URLs
const adTagUrls = [
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=",
  "https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=",
  "https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_ad_samples&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&impl=s&correlator=",
];

// Initialize IMA SDK
function initializeIMA() {
  console.log("Initializing IMA");
  adDisplayContainer = new google.ima.AdDisplayContainer(
    document.getElementById("adContainer"),
    audioContent
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

// Request Ads
function requestAds(adType) {
  console.log(`Requesting ${adType} ad, using tag index ${currentAdTagIndex}`);
  const adsRequest = new google.ima.AdsRequest();

  adsRequest.adTagUrl = adTagUrls[currentAdTagIndex];

  // Add a timestamp to prevent caching
  adsRequest.adTagUrl += "&correlator=" + Date.now();

  adsRequest.linearAdSlotWidth = 640;
  adsRequest.linearAdSlotHeight = 400;

  // Specify the ad type in the tag URL
  adsRequest.adTagUrl += "&ad_type=" + adType;

  console.log("Using ad tag URL:", adsRequest.adTagUrl);

  currentAdType = adType; // Track the current ad type

  adsLoader.requestAds(adsRequest);
}

// Handle Ads Manager Loaded Event
function onAdsManagerLoaded(adsManagerLoadedEvent) {
  console.log("Ads Manager Loaded");
  const adsRenderingSettings = new google.ima.AdsRenderingSettings();
  adsRenderingSettings.restoreCustomPlaybackStateOnAdBreakComplete = true;
  adsManager = adsManagerLoadedEvent.getAdsManager(
    audioContent,
    adsRenderingSettings
  );

  // Add event listeners
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

// Play Ads
function playAds() {
  console.log("Playing ads");
  audioContent.pause();
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

// Handle Ad Events
function onAdEvent(adEvent) {
  console.log("Ad event:", adEvent.type);
  const ad = adEvent.getAd();
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
          const remainingTime = adsManager.getRemainingTime();
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
    default:
      // Handle other ad events if necessary
      break;
  }
}

// Handle Ad Errors
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

// Handle Content Pause Request
function onContentPauseRequested() {
  console.log("Content pause requested");
  audioContent.pause();
}

// Handle Content Resume Request
function onContentResumeRequested() {
  console.log("Content resume requested");
  adPlaying = false;
  resumeContent();
}

// Resume Content Playback
function resumeContent() {
  console.log("Resuming content");
  if (!audioContent.ended) {
    audioContent
      .play()
      .then(() => {
        console.log("Audio playback resumed");
        if (currentAdType === "pre-roll") {
          // Re-enable the Play with Ad button after pre-roll ad
          const playButton = document.getElementById("playWithAd");
          if (playButton.disabled) {
            playButton.disabled = false;
            playButton.textContent = "Play with Ad";
          }
        }
      })
      .catch((error) => {
        console.error("Error resuming audio playback:", error);
      });
  } else {
    console.log("Content playback complete");
    // Reset audio to allow replay
    audioContent.currentTime = 0;

    // Re-enable the Play with Ad button to allow multiple playbacks
    const playButton = document.getElementById("playWithAd");
    if (playButton.disabled) {
      playButton.disabled = false;
      playButton.textContent = "Play with Ad";
    }
  }
}

// Handle "Play with Ad" Button Click
function setupButtonListener() {
  const playButton = document.getElementById("playWithAd");
  playButton.addEventListener("click", function () {
    if (!adPlaying && audioContent.currentTime === 0) {
      // Disable the Play button to prevent multiple clicks
      playButton.disabled = true;
      playButton.textContent = "Loading Ad...";

      // Request and play pre-roll ad
      currentAdTagIndex = 0; // Reset to first ad tag
      requestAds("pre-roll");
    }
  });
}

// Handle Post-roll Ad After Content Ends
function setupPostRollListener() {
  audioContent.addEventListener("ended", function () {
    console.log("Content ended");
    currentAdTagIndex = 0; // Reset to first ad tag for post-roll
    requestAds("post-roll");
  });
}

// Prevent Manual Play from Audio Controls
function preventManualPlay() {
  audioContent.addEventListener("play", function (event) {
    if (
      !adPlaying &&
      audioContent.currentTime === 0 &&
      currentAdType !== "pre-roll"
    ) {
      console.log(
        "Manual play attempted. Preventing and requiring 'Play with Ad' button."
      );
      event.preventDefault();
      // Show a message to the user
      alert(
        "Please use the 'Play with Ad' button to start playback with an ad."
      );
    }
  });
}

// Initialize Everything on Window Load
window.addEventListener("load", function () {
  console.log("Window loaded");
  audioContent = document.getElementById("contentPlayer");
  setupButtonListener();
  setupPostRollListener();
  preventManualPlay();
  initializeIMA();
});
