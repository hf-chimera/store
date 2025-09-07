import { describe, expect, it } from "vitest";
import { ChimeraEventEmitter } from "./ChimeraEventEmitter.ts";

describe("ChimeraEventEmitter", () => {
	describe("ChimeraEventEmitter#emit", () => {
		it("should return false when there are not events to emit", () => {
			var e = new ChimeraEventEmitter();

			expect(e.emit("foo")).equals(false);
			expect(e.emit("bar")).equals(false);
		});

		it("can emit the function with single argument", () => {
			var e = new ChimeraEventEmitter();

			for (var i = 0; i < 100; i++) {
				((j) => {
					const argValue = j;

					e.once("args", (arg) => {
						expect(arg).equals(argValue);
					});

					e.emit("args", argValue);
				})(i);
			}
		});

		it("can emit the function with single argument, multiple listeners", () => {
			var e = new ChimeraEventEmitter();

			for (var i = 0; i < 100; i++) {
				((j) => {
					const argValue = j;

					e.once("args", (arg) => {
						expect(arg).equals(argValue);
					});

					e.once("args", (arg) => {
						expect(arg).equals(argValue);
					});

					e.once("args", (arg) => {
						expect(arg).equals(argValue);
					});

					e.once("args", (arg) => {
						expect(arg).equals(argValue);
					});

					e.emit("args", argValue);
				})(i);
			}
		});

		it("should return true when there are events to emit", () => {
			var e = new ChimeraEventEmitter();
			var called = 0;

			e.on("foo", () => {
				called++;
			});

			expect(e.emit("foo")).equals(true);
			expect(e.emit("foob")).equals(false);
			expect(called).equals(1);
		});

		it("receives the emitted events", () => {
			var e = new ChimeraEventEmitter();
			var testDate = new Date();

			e.on("data", (eventData) => {
				expect(eventData.message).equals("foo");
				expect(eventData.emitter).equals(e);
				expect(eventData.timestamp).equals(testDate);
				expect(eventData.extra).equals(undefined);
			});

			e.emit("data", {emitter: e, extra: undefined, message: "foo", timestamp: testDate});
		});

		it("emits to all event listeners", () => {
			var e = new ChimeraEventEmitter();
			var pattern: string[] = [];

			e.on("foo", () => {
				pattern.push("foo1");
			});

			e.on("foo", () => {
				pattern.push("foo2");
			});

			e.emit("foo");

			expect(pattern.join(";")).equals("foo1;foo2");
		});
	});

	describe("ChimeraEventEmitter#listeners", () => {
		it("returns an empty array if no listeners are specified", () => {
			var e = new ChimeraEventEmitter();

			expect(e.listeners("foo")).is.a("array");
			expect(e.listeners("foo").length).equals(0);
		});

		it("returns an array of function", () => {
			var e = new ChimeraEventEmitter();

			function foo() {}

			e.on("foo", foo);
			expect(e.listeners("foo")).is.a("array");
			expect(e.listeners("foo").length).equals(1);
			expect(e.listeners("foo")).deep.equals([foo]);
		});

		it("is not vulnerable to modifications", () => {
			var e = new ChimeraEventEmitter();

			function foo() {}

			e.on("foo", foo);

			expect(e.listeners("foo")).deep.equals([foo]);

			e.listeners("foo").length = 0;
			expect(e.listeners("foo")).deep.equals([foo]);
		});
	});

	describe("ChimeraEventEmitter#listenerCount", () => {
		it("returns the number of listeners for a given event", () => {
			var e = new ChimeraEventEmitter();

			expect(e.listenerCount("foo")).equals(0);

			e.on("foo", () => {});
			expect(e.listenerCount("foo")).equals(1);
			e.on("foo", () => {});
			expect(e.listenerCount("foo")).equals(2);
		});
	});

	describe("ChimeraEventEmitter#once", () => {
		it("only emits it once", () => {
			var e = new ChimeraEventEmitter();
			var calls = 0;

			e.once("foo", () => {
				calls++;
			});

			e.emit("foo");
			e.emit("foo");
			e.emit("foo");
			e.emit("foo");
			e.emit("foo");

			expect(e.listeners("foo").length).equals(0);
			expect(calls).equals(1);
		});

		it("only emits once if emits are nested inside the listener", () => {
			var e = new ChimeraEventEmitter();
			var calls = 0;

			e.once("foo", () => {
				calls++;
				e.emit("foo");
			});

			e.emit("foo");
			expect(e.listeners("foo").length).equals(0);
			expect(calls).equals(1);
		});

		it("only emits once for multiple events", () => {
			var e = new ChimeraEventEmitter();
			var multi = 0;
			var foo = 0;
			var bar = 0;

			e.once("foo", () => {
				foo++;
			});

			e.once("foo", () => {
				bar++;
			});

			e.on("foo", () => {
				multi++;
			});

			e.emit("foo");
			e.emit("foo");
			e.emit("foo");
			e.emit("foo");
			e.emit("foo");

			expect(e.listeners("foo").length).equals(1);
			expect(multi).equals(5);
			expect(foo).equals(1);
			expect(bar).equals(1);
		});
	});

	describe("ChimeraEventEmitter#removeListener", () => {
		it("removes all listeners when the listener is not specified", () => {
			var e = new ChimeraEventEmitter();

			e.on("foo", () => {});
			e.on("foo", () => {});

			expect(e.removeListener("foo")).equals(e);
			expect(e.listeners("foo")).eql([]);
		});

		it("removes only the listeners matching the specified listener", () => {
			var e = new ChimeraEventEmitter();

			function foo() {}

			function bar() {}

			function baz() {}

			e.on("foo", foo);
			e.on("bar", bar);
			e.on("bar", baz);

			expect(e.removeListener("foo", bar)).equals(e);
			expect(e.listeners("bar")).eql([bar, baz]);
			expect(e.listeners("foo")).eql([foo]);
			expect(e._eventsCount).equals(2);

			expect(e.removeListener("foo", foo)).equals(e);
			expect(e.listeners("bar")).eql([bar, baz]);
			expect(e.listeners("foo")).eql([]);
			expect(e._eventsCount).equals(1);

			expect(e.removeListener("bar", bar)).equals(e);
			expect(e.listeners("bar")).eql([baz]);
			expect(e._eventsCount).equals(1);

			expect(e.removeListener("bar", baz)).equals(e);
			expect(e.listeners("bar")).eql([]);
			expect(e._eventsCount).equals(0);

			e.on("foo", foo);
			e.on("foo", foo);
			e.on("bar", bar);

			expect(e.removeListener("foo", foo)).equals(e);
			expect(e.listeners("bar")).eql([bar]);
			expect(e.listeners("foo")).eql([]);
			expect(e._eventsCount).equals(1);
		});

		it("removes only the once listeners when using the once flag", () => {
			var e = new ChimeraEventEmitter();

			function foo() {}

			e.on("foo", foo);

			expect(e.removeListener("foo", () => {}, true)).equals(e);
			expect(e.listeners("foo")).eql([foo]);
			expect(e._eventsCount).equals(1);

			expect(e.removeListener("foo", foo, true)).equals(e);
			expect(e.listeners("foo")).eql([foo]);
			expect(e._eventsCount).equals(1);

			expect(e.removeListener("foo", foo)).equals(e);
			expect(e.listeners("foo")).eql([]);
			expect(e._eventsCount).equals(0);

			e.once("foo", foo);
			e.on("foo", foo);

			expect(e.removeListener("foo", () => {}, true)).equals(e);
			expect(e.listeners("foo")).eql([foo, foo]);
			expect(e._eventsCount).equals(1);

			expect(e.removeListener("foo", foo, true)).equals(e);
			expect(e.listeners("foo")).eql([foo]);
			expect(e._eventsCount).equals(1);

			e.once("foo", foo);

			expect(e.removeListener("foo", foo)).equals(e);
			expect(e.listeners("foo")).eql([]);
			expect(e._eventsCount).equals(0);
		});
	});

	describe("ChimeraEventEmitter#removeAllListeners", () => {
		it("removes all events for the specified events", () => {
			var e = new ChimeraEventEmitter();

			e.on("foo", () => {
				throw new Error("oops");
			});
			e.on("foo", () => {
				throw new Error("oops");
			});
			e.on("bar", () => {
				throw new Error("oops");
			});
			e.on("aaa", () => {
				throw new Error("oops");
			});

			expect(e.removeAllListeners("foo")).equals(e);
			expect(e.listeners("foo").length).equals(0);
			expect(e.listeners("bar").length).equals(1);
			expect(e.listeners("aaa").length).equals(1);
			expect(e._eventsCount).equals(2);

			expect(e.removeAllListeners("bar")).equals(e);
			expect(e._eventsCount).equals(1);
			expect(e.removeAllListeners("aaa")).equals(e);
			expect(e._eventsCount).equals(0);

			expect(e.emit("foo")).equals(false);
			expect(e.emit("bar")).equals(false);
			expect(e.emit("aaa")).equals(false);
		});

		it("just nukes the fuck out of everything", () => {
			var e = new ChimeraEventEmitter();

			e.on("foo", () => {
				throw new Error("oops");
			});
			e.on("foo", () => {
				throw new Error("oops");
			});
			e.on("bar", () => {
				throw new Error("oops");
			});
			e.on("aaa", () => {
				throw new Error("oops");
			});

			expect(e.removeAllListeners()).equals(e);
			expect(e.listeners("foo").length).equals(0);
			expect(e.listeners("bar").length).equals(0);
			expect(e.listeners("aaa").length).equals(0);
			expect(e._eventsCount).equals(0);

			expect(e.emit("foo")).equals(false);
			expect(e.emit("bar")).equals(false);
			expect(e.emit("aaa")).equals(false);
		});
	});

	describe("ChimeraEventEmitter#eventNames", () => {
		it("returns an empty array when there are no events", () => {
			var e = new ChimeraEventEmitter();

			expect(e.eventNames()).eql([]);

			e.on("foo", () => {});
			e.removeAllListeners("foo");

			expect(e.eventNames()).eql([]);
		});
	});
});
