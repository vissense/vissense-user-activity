/*global VisSense:true*/
/**
 * @license
 * Available under MIT license <http://opensource.org/licenses/MIT>
 */
'use strict';

var Utils = VisSense.Utils;
var debounce = Utils.debounce;
var defaults = Utils.defaults;
var isFunction = Utils.isFunction;
var noop = Utils.noop;
var now = Utils.now;

function fireListeners(listeners, context) {
  for (var i = 0, n = listeners.length; i < n; i++) {
    listeners[i].call(context || window);
  }
}

function UserActivity(config) {
  if (!(this instanceof UserActivity)) {
    return new UserActivity(config);
  }

  this._config = defaults(config, {
    inactiveAfter: 60 * 1000, //ms
    debounce: 100, //ms
    events: [
      'resize', 'scroll',
      'mousemove', 'mousewheel',
      'keydown', 'mousedown',
      'touchstart', 'touchmove'
    ]
  });

  this._listeners = [];
  this._clearTimeout = noop;

  this._state = {
    active: true,
    changed: false,
    lastActivityTime: now(),
    started: false
  };

  this._setActive = function(active) {
    this._state.changed = this._state.active !== active;
    this._state.active = active;
  };

  var me = this;
  this._updateState = function () {
    console.debug('Updating state');
    var lastActivityTime = me.getTimeSinceLastActivity();
    if (lastActivityTime >= me._config.inactiveAfter) {
      me._setActive(false);
      console.debug('User is considered inactive.');
    } else {
      console.debug('Limit not reached: %i >= %i', lastActivityTime, me._config.inactiveAfter);

      me._clearTimeout();

      console.debug('Cancelled timeout and reschedule again.');

      me._clearTimeout = (function (callback, timeout) {
        console.debug('Timeout is scheduled to run in %i ms.', timeout);
        var timeoutId = setTimeout(callback, timeout);
        return function () {
          console.debug('Timeout cancelled.');
          clearTimeout(timeoutId);
        };
      })(function() {
        console.debug('Timeout executed.');
        me._updateState();
      }, me._config.inactiveAfter);
    }

    fireListeners(me._listeners, me);
  };

  this._onUserActivity = function () {
    me._state.lastActivityTime = now();

    me._setActive(true);

    console.debug('User is considered active.');

    me._updateState();
  };
}

UserActivity.prototype.start = function () {
  if (this._state.started) {
    return this;
  }
  console.debug('Start watching for User Activities.');

  var me = this;
  this._removeEventListeners = (function addEventListeners() {
    var onUserActivity = debounce(me._onUserActivity, me._config.debounce);

    var events = me._config.events;
    for (var i = 0, n = events.length; i < n; ++i) {
      addEventListener(events[i], onUserActivity, false);
    }

    return function () {
      for (var i = 0, n = events.length; i < n; ++i) {
        removeEventListener(events[i], onUserActivity, false);
      }
    };
  })();

  this._state.started = true;

  // init with fake user action
  this._onUserActivity();

  return this;
};

UserActivity.prototype.stop = function () {
  if (!this._state.started) {
    return this;
  }
  console.debug('Stop watching for User Activities.');

  this._removeEventListeners();
  this._clearTimeout();

  this._state.started = false;

  return this;
};

UserActivity.prototype.onUpdate = function (callback) {
  if (!isFunction(callback)) {
    return noop;
  }
  var listener = callback.bind(undefined, this);
  this._listeners.push(listener);

  var me = this;
  return function () {
    var index = me._listeners.indexOf(listener);

    console.debug('Removing listener on index %i', index);

    if (index > -1) {
      me._listeners.splice(index, 1);
      return true;
    }
    return false;
  };
};

UserActivity.prototype.onActive = function (callback) {
  var me = this;
  return this.onUpdate(function () {
    if (me._state.changed && me._state.active) {
      console.debug('Calling onActive listener');
      callback(me);
    }
  });
};

UserActivity.prototype.onInactive = function (callback) {
  var me = this;
  return this.onUpdate(function () {
    if (me._state.changed && !me._state.active) {
      console.debug('Calling onInactive listener');
      callback(me);
    }
  });
};

UserActivity.prototype.isActive = function () {
  return !this._state.started || this._state.active;
};

UserActivity.prototype.getTimeSinceLastActivity = function () {
  return now() - this._state.lastActivityTime;
};

VisSense.UserActivity = UserActivity;
