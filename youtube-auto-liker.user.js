// ==UserScript==
// @name           YouTube Auto-Liker
// @namespace      https://github.com/DrymarchonShaun/youtube-auto-liker
// @version        0.0.1
// @description    Automatically likes videos of channels you're subscribed to
// @author         DrymarchonShaun
// @license        MIT
// @icon           https://raw.githubusercontent.com/DrymarchonShaun/youtube-auto-liker/master/logo.svg
// @downloadurl    https://github.com/DrymarchonShaun/youtube-auto-liker/raw/master/youtube-auto-liker.user.js
// @updateurl      https://github.com/DrymarchonShaun/youtube-auto-liker/raw/master/youtube-auto-liker.user.js
// @match          http://*.youtube.com/*
// @match          https://*.youtube.com/*
// @grant          GM_getValue
// @grant          GM_setValue
// @run-at         document-idle
// @noframes
// ==/UserScript==

(() => {
  'use strict';

  // Function to initialize default settings only if missing
  function initializeSetting(key, defaultValue) {
    if (GM_getValue(key) === undefined) {
      GM_setValue(key, defaultValue);
    }
    return GM_getValue(key);
  }

  // Initialize settings with default values if they are missing
  const settings = {
    DEBUG_MODE: initializeSetting('DEBUG_MODE', false),
    CHECK_FREQUENCY: initializeSetting('CHECK_FREQUENCY', 5000),
    WATCH_THRESHOLD: initializeSetting('WATCH_THRESHOLD', 50),
    LIKE_IF_NOT_SUBSCRIBED: initializeSetting('LIKE_IF_NOT_SUBSCRIBED', false),
    AUTO_LIKE_LIVE_STREAMS: initializeSetting('AUTO_LIKE_LIVE_STREAMS', false)
  };

  // Debugger class for console logging if debug mode is enabled
  class Debugger {
    constructor(name, enabled) {
      this.debug = {};
      if (!window.console) return () => { };
      Object.getOwnPropertyNames(window.console).forEach((key) => {
        this.debug[key] = enabled
          ? window.console[key].bind(window.console, name + ': ')
          : () => { };
      });
      return this.debug;
    }
  }

  const DEBUG = new Debugger('YouTube Auto-Liker', settings.DEBUG_MODE);
  const SELECTORS = {
    PLAYER: '#movie_player',
    SUBSCRIBE_BUTTON: '#subscribe-button > ytd-subscribe-button-renderer, ytd-reel-player-overlay-renderer #subscribe-button',
    LIKE_BUTTON: 'like-button-view-model button, #menu .YtLikeButtonViewModelHost button, #segmented-like-button button, #like-button button',
    DISLIKE_BUTTON: 'dislike-button-view-model button, #menu .YtDislikeButtonViewModelHost button, #segmented-dislike-button button, #dislike-button button'
  };
  const autoLikedVideoIds = [];

  // Function to get the video ID
  function getVideoId() {
    const elem = document.querySelector('#page-manager > ytd-watch-flexy');
    return elem && elem.hasAttribute('video-id')
      ? elem.getAttribute('video-id')
      : new URLSearchParams(window.location.search).get('v');
  }

  // Check if watch threshold is reached
  function watchThresholdReached() {
    const player = document.querySelector(SELECTORS.PLAYER);
    if (player) {
      const watched = player.getCurrentTime() / player.getDuration();
      const watchedTarget = settings.WATCH_THRESHOLD / 100;
      if (watched < watchedTarget) {
        DEBUG.info(`Waiting until watch threshold reached (${watched.toFixed(2)}/${watchedTarget})...`);
        return false;
      }
    }
    return true;
  }

  // Check if the user is subscribed
  function isSubscribed() {
    DEBUG.info('Checking whether subscribed...');
    const subscribeButton = document.querySelector(SELECTORS.SUBSCRIBE_BUTTON);
    if (!subscribeButton) throw Error("Couldn't find sub button");
    const subscribed = subscribeButton.hasAttribute('subscribe-button-invisible') || subscribeButton.hasAttribute('subscribed');
    DEBUG.info(subscribed ? 'We are subscribed' : 'We are not subscribed');
    return subscribed;
  }

  // Main function to check conditions and like the video if criteria are met
  function wait() {
    if (watchThresholdReached()) {
      try {
        if (settings.LIKE_IF_NOT_SUBSCRIBED || isSubscribed()) {
          if (settings.AUTO_LIKE_LIVE_STREAMS || window.getComputedStyle(document.querySelector('.ytp-live-badge')).display === 'none') {
            like();
          }
        }
      } catch (e) {
        DEBUG.info(`Failed to like video: ${e}. Will try again in ${settings.CHECK_FREQUENCY} ms...`);
      }
    }
  }

  // Check if a button is already pressed
  function isButtonPressed(button) {
    return button.classList.contains('style-default-active') || button.getAttribute('aria-pressed') === 'true';
  }

  // Like the video
  function like() {
    DEBUG.info('Trying to like video...');
    const likeButton = document.querySelector(SELECTORS.LIKE_BUTTON);
    const dislikeButton = document.querySelector(SELECTORS.DISLIKE_BUTTON);
    if (!likeButton) throw Error("Couldn't find like button");
    if (!dislikeButton) throw Error("Couldn't find dislike button");
    const videoId = getVideoId();
    if (isButtonPressed(likeButton)) {
      DEBUG.info('Like button has already been clicked');
      autoLikedVideoIds.push(videoId);
    } else if (isButtonPressed(dislikeButton)) {
      DEBUG.info('Dislike button has already been clicked');
    } else if (autoLikedVideoIds.includes(videoId)) {
      DEBUG.info('Video has already been auto-liked. User must have un-liked it, so we won\'t like it again');
    } else {
      DEBUG.info('Found like button. It\'s unclicked. Clicking it...');
      likeButton.click();
      if (isButtonPressed(likeButton)) {
        autoLikedVideoIds.push(videoId);
        DEBUG.info('Successfully liked video');
      } else {
        DEBUG.info('Failed to like video');
      }
    }
  }

  // Set an interval to repeatedly check and potentially like videos
  setInterval(wait, settings.CHECK_FREQUENCY);
})();
