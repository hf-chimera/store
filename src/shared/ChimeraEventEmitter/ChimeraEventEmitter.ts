type ValidEventTypes = string | object;

export type EventNames<T extends ValidEventTypes> = T extends string ? T : keyof T;

type ArgumentMap<T extends object> = {
	[K in keyof T]: T[K] extends (...args: any[]) => void ? Parameters<T[K]>[0] : T[K] extends any[] ? T[K][0] : T[K];
};

type EventListener<T extends ValidEventTypes, K extends EventNames<T>> = T extends string
	? (arg: any) => void
	: (arg: ArgumentMap<Exclude<T, string | symbol>>[Extract<K, keyof T>]) => void;

export type EventArgs<T extends ValidEventTypes, K extends EventNames<T>> = Parameters<EventListener<T, K>>[0];

type EventRecord<TTEventTypes extends ValidEventTypes, TEventNames extends EventNames<TTEventTypes>> = {
	fn: EventListener<TTEventTypes, TEventNames>;
	once: boolean;
};

type EventRecordMap<T extends ValidEventTypes> = {
	[K in EventNames<T>]?: EventRecord<T, K> | EventRecord<T, K>[];
};

var Events = function Events() {} as unknown as { new (): EventRecordMap<any> };
Events.prototype = Object.create(null);

export class ChimeraEventEmitter<TEventTypes extends ValidEventTypes = string> {
	_events: EventRecordMap<TEventTypes>;
	_eventsCount;

	constructor() {
		this._events = new Events();
		this._eventsCount = 0;
	}

	#addListener<T extends EventNames<TEventTypes>>(event: T, fn: EventListener<TEventTypes, T>, once: boolean): this {
		var listener = { fn, once };

		if (!this._events[event]) {
			this._events[event] = listener;
			this._eventsCount++;
		} else if (!(this._events[event] as EventRecord<TEventTypes, T>).fn)
			(this._events[event] as EventRecord<TEventTypes, T>[]).push(listener);
		else this._events[event] = [this._events[event] as EventRecord<TEventTypes, T>, listener];

		return this;
	}

	#clearEvent<T extends EventNames<TEventTypes>>(event: T) {
		if (--this._eventsCount === 0) this._events = new Events();
		else delete this._events[event];
	}

	eventNames(): EventNames<TEventTypes>[] {
		return Object.keys(this._events) as EventNames<TEventTypes>[];
	}

	listeners<T extends EventNames<TEventTypes>>(event: T): EventListener<TEventTypes, T>[] {
		var handlers = this._events[event];

		if (!handlers) return [];
		if ((handlers as EventRecord<TEventTypes, T>).fn) return [(handlers as EventRecord<TEventTypes, T>).fn];

		for (var i = 0, l = (handlers as EventRecord<TEventTypes, T>[]).length, ee = new Array(l); i < l; i++) {
			ee[i] = (handlers as [EventRecord<TEventTypes, T>])[i as 0].fn;
		}

		return ee;
	}

	listenerCount(event: EventNames<TEventTypes>): number {
		var listeners = this._events[event];

		if (!listeners) return 0;
		if ((listeners as EventRecord<TEventTypes, EventNames<TEventTypes>>).fn) return 1;
		return (listeners as []).length;
	}

	removeListener<T extends EventNames<TEventTypes>>(
		event: T,
		fn?: EventListener<TEventTypes, T>,
		once?: boolean,
	): this {
		if (!this._events[event]) return this;
		if (!fn) {
			this.#clearEvent(event);
			return this;
		}

		var listeners = this._events[event];

		if ((listeners as EventRecord<TEventTypes, T>).fn) {
			if (
				(listeners as EventRecord<TEventTypes, T>).fn === fn &&
				(!once || (listeners as EventRecord<TEventTypes, T>).once)
			) {
				this.#clearEvent(event);
			}
		} else {
			for (var i = 0, events = [], length = (listeners as EventRecord<TEventTypes, T>[]).length; i < length; i++) {
				if (
					(listeners as [EventRecord<TEventTypes, T>])[i as 0].fn !== fn ||
					(once && !(listeners as [EventRecord<TEventTypes, T>])[i as 0].once)
				) {
					events.push((listeners as [EventRecord<TEventTypes, T>])[i as 0]);
				}
			}

			//
			// Reset the array or remove it completely if we have no more listeners.
			//
			if (events.length) this._events[event] = events.length === 1 ? events[0] : events;
			else this.#clearEvent(event);
		}

		return this;
	}

	emit<T extends EventNames<TEventTypes>>(event: T, arg?: EventArgs<TEventTypes, T>): boolean {
		if (!this._events[event]) return false;

		var listeners = this._events[event];

		if ((listeners as EventRecord<TEventTypes, T>).fn) {
			if ((listeners as EventRecord<TEventTypes, T>).once)
				this.removeListener(event, (listeners as EventRecord<TEventTypes, T>).fn, true);
			(listeners as EventRecord<any, any>).fn.call(this, arg);
		} else {
			for (var i = 0, length = (listeners as []).length; i < length; i++) {
				if ((listeners as [EventRecord<TEventTypes, T>])[i as 0].once)
					this.removeListener(event, (listeners as [EventRecord<TEventTypes, T>])[i as 0].fn, true);
				(listeners as [EventRecord<any, any>])[i as 0].fn.call(this, arg);
			}
		}

		return true;
	}

	on<T extends EventNames<TEventTypes>>(event: T, fn: EventListener<TEventTypes, T>): this {
		return this.#addListener(event, fn, false);
	}

	once<T extends EventNames<TEventTypes>>(event: T, fn: EventListener<TEventTypes, T>): this {
		return this.#addListener(event, fn, true);
	}

	removeAllListeners(event?: EventNames<TEventTypes>): this {
		if (event) {
			if (this._events[event]) this.#clearEvent(event);
		} else {
			this._events = new Events();
			this._eventsCount = 0;
		}

		return this;
	}

	off = this.removeListener;
	addListener = this.on;
}

export type AnyChimeraEventEmitter = ChimeraEventEmitter<any>;
export type ChimeraEventEmitterEvents<TEventEmitter extends AnyChimeraEventEmitter> =
	TEventEmitter extends ChimeraEventEmitter<infer TEventTypes>
		? { [K in EventNames<TEventTypes>]: EventListener<TEventTypes, K> }
		: never;
export type ChimeraEventEmitterEventNames<TEventEmitter extends AnyChimeraEventEmitter> =
	keyof ChimeraEventEmitterEvents<TEventEmitter>;
