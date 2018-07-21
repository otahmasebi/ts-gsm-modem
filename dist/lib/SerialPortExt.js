"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/// <reference path="./ambient/serialport.d.ts"/>
var SerialPort = require("serialport");
var runExclusive = require("run-exclusive");
var ts_events_extended_1 = require("ts-events-extended");
var openTimeOut = 5000;
/** Do not use on("error",) use evtError otherwise use as SerialPort */
var SerialPortExt = /** @class */ (function (_super) {
    __extends(SerialPortExt, _super);
    function SerialPortExt() {
        //Todo test if when terminate still running because of evtError
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.evtError = (function () {
            var evt = new ts_events_extended_1.SyncEvent();
            _this.once("error", function (error) { return evt.post(new SerialPortError(error, _this.writeHistory, "EMITTED BY SERIAL PORT INSTANCE")); });
            return evt;
        })();
        _this.writeHistory = [];
        /**
         * Never throw, never resolve if error ( an evtError will be posted )
         * Assert is not called after close as we have no way to test if closed.
         */
        _this.writeAndDrain = runExclusive.buildMethod(function (buffer) { return __awaiter(_this, void 0, void 0, function () {
            var timer_1, onceOpen_1, onceClose_1, onceError_1, result, _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (this.writeHistory.length > 6) {
                            this.writeHistory.shift();
                        }
                        this.writeHistory.push(buffer);
                        if (!!this.isOpen()) return [3 /*break*/, 7];
                        return [4 /*yield*/, Promise.race([
                                new Promise(function (resolve) {
                                    onceOpen_1 = function () { return resolve("OPEN"); };
                                    _this.once("open", onceOpen_1);
                                }),
                                new Promise(function (resolve) {
                                    onceClose_1 = function () { return resolve("TERMINATED"); };
                                    _this.once("close", onceClose_1);
                                }),
                                new Promise(function (resolve) {
                                    onceError_1 = function () { return resolve("TERMINATED"); };
                                    _this.once("error", onceClose_1);
                                }),
                                new Promise(function (resolve) {
                                    return timer_1 = setTimeout(function () { return resolve("TIMEOUT"); }, openTimeOut);
                                })
                            ])];
                    case 1:
                        result = _b.sent();
                        this.removeListener("open", onceOpen_1);
                        this.removeListener("close", onceClose_1);
                        this.removeListener("error", onceError_1);
                        clearTimeout(timer_1);
                        _a = result;
                        switch (_a) {
                            case "OPEN": return [3 /*break*/, 2];
                            case "TERMINATED": return [3 /*break*/, 3];
                            case "TIMEOUT": return [3 /*break*/, 5];
                        }
                        return [3 /*break*/, 7];
                    case 2: return [3 /*break*/, 7];
                    case 3: return [4 /*yield*/, new Promise(function (resolve) { })];
                    case 4:
                        _b.sent();
                        _b.label = 5;
                    case 5:
                        this.evtError.post(new SerialPortError("Serial port took too much time to open", this.writeHistory, "OPEN TIMEOUT"));
                        return [4 /*yield*/, new Promise(function (resolve) { })];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7: return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                            var error;
                            var _this = this;
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0: return [4 /*yield*/, new Promise(function (resolve) { return _this.write(buffer, function (error) { return resolve(error); }); })];
                                    case 1:
                                        error = _a.sent();
                                        if (!!!error) return [3 /*break*/, 3];
                                        this.evtError.post(new SerialPortError(error, this.writeHistory, "ERROR CALLING WRITE"));
                                        return [4 /*yield*/, new Promise(function (resolve) { })];
                                    case 2:
                                        _a.sent();
                                        _a.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        }); })()];
                    case 8:
                        _b.sent();
                        return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                                var error;
                                var _this = this;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, new Promise(function (resolve) { return _this.drain(function (error) { return resolve(error); }); })];
                                        case 1:
                                            error = _a.sent();
                                            if (!!!error) return [3 /*break*/, 3];
                                            this.evtError.post(new SerialPortError(error, this.writeHistory, "ERROR CALLING DRAIN"));
                                            return [4 /*yield*/, new Promise(function (resolve) { })];
                                        case 2:
                                            _a.sent();
                                            _a.label = 3;
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); })()];
                    case 9:
                        _b.sent();
                        return [2 /*return*/];
                }
            });
        }); });
        return _this;
    }
    return SerialPortExt;
}(SerialPort));
exports.SerialPortExt = SerialPortExt;
var SerialPortError = /** @class */ (function (_super) {
    __extends(SerialPortError, _super);
    function SerialPortError(originalError, writeHistory, origin) {
        var _newTarget = this.constructor;
        var _this = _super.call(this, "Error produced by node-serialport") || this;
        _this.writeHistory = writeHistory;
        _this.origin = origin;
        Object.setPrototypeOf(_this, _newTarget.prototype);
        if (typeof originalError === "string") {
            _this.originalError = new Error(originalError);
        }
        else {
            _this.originalError = originalError;
        }
        return _this;
    }
    SerialPortError.prototype.toString = function () {
        return [
            "SerialPortExtError: " + this.message,
            "Origin: " + this.origin,
            "message: " + this.originalError.message,
            "Previous write (older to newest): " + JSON.stringify(this.writeHistory.map(function (b) { return "" + b; }), null, 2)
        ].join("\n");
    };
    return SerialPortError;
}(Error));
exports.SerialPortError = SerialPortError;
