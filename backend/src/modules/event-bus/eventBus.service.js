const EventEmitter = require("events");

class EventBusService extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publish an event with optional data
   * @param {string} eventName 
   * @param {any} data 
   */
  publish(eventName, data) {
    console.log(`[EventBus] Dispatching event: ${eventName}`, data);
    this.emit(eventName, data);
  }

  /**
   * Subscribe a callback to an event
   * @param {string} eventName 
   * @param {function} listener 
   */
  subscribe(eventName, listener) {
    console.log(`[EventBus] Registered listener for: ${eventName}`);
    this.on(eventName, listener);
  }
}

module.exports = new EventBusService();
