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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t;
    return { next: verb(0), "throw": verb(1), "return": verb(2) };
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = y[op[0] & 2 ? "return" : op[0] ? "throw" : "next"]) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [0, t.value];
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
var SerialPortExt_1 = require("./SerialPortExt");
var promisify = require("ts-promisify");
var ts_events_extended_1 = require("ts-events-extended");
var ts_exec_queue_1 = require("ts-exec-queue");
var timer_extended_1 = require("timer-extended");
var _debug = require("debug");
var debug = _debug("_AtStack");
require("colors");
var at_messages_parser_1 = require("at-messages-parser");
var Timers = (function (_super) {
    __extends(Timers, _super);
    function Timers() {
        var _newTarget = this.constructor;
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, _newTarget.prototype);
        return _this;
    }
    Timers.prototype.add = function (timer) {
        for (var index = 0; index < this.length; index++)
            if (this[index].hasExec || this[index].hasBeenCleared)
                this.splice(index, 1);
        _super.prototype.push.call(this, timer);
        return timer;
    };
    Timers.prototype.clearAll = function () {
        for (var _i = 0, _a = this; _i < _a.length; _i++) {
            var timer = _a[_i];
            timer.clear();
        }
    };
    return Timers;
}(Array));
exports.Timers = Timers;
var AtStack = (function () {
    function AtStack(path) {
        this.timers = new Timers();
        this.evtUnsolicitedMessage = new ts_events_extended_1.SyncEvent();
        this.evtTerminate = new ts_events_extended_1.SyncEvent();
        this.serialPortAtParser = at_messages_parser_1.getSerialPortParser(30000);
        this.evtError = new ts_events_extended_1.SyncEvent();
        this.evtResponseAtMessage = new ts_events_extended_1.SyncEvent();
        this.parseErrorDelay = 30000;
        this.runCommand = ts_exec_queue_1.execQueue(this.runCommandManageParams);
        this.reportMode = undefined;
        this.isEchoEnable = undefined;
        this.hideEcho = false;
        this.maxRetry = 10;
        this.delayBeforeRetry = 5000;
        this.retryLeft = this.maxRetry;
        this.maxRetryWrite = 3;
        this.delayReWrite = 5000;
        this.retryLeftWrite = this.maxRetryWrite;
        this.serialPort = new SerialPortExt_1.SerialPortExt(path, {
            "parser": this.serialPortAtParser
        });
        this.registerListeners();
        this.runCommand("ATZ\r");
    }
    Object.defineProperty(AtStack.prototype, "isTerminated", {
        get: function () {
            return (this.evtTerminate.postCount !== 0);
        },
        enumerable: true,
        configurable: true
    });
    AtStack.prototype.terminate = function (error) {
        debug("terminate have been called externally".red);
        if (this.serialPort.isOpen())
            this.serialPort.close();
        this.evtTerminate.post((error) ? error : null);
    };
    AtStack.prototype.registerListeners = function () {
        var _this = this;
        this.evtError.attach(function (error) { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        debug("unrecoverable error: ".red, error);
                        return [4 /*yield*/, new Promise(function (resolve) { return setImmediate(resolve); })];
                    case 1:
                        _a.sent();
                        if (this.serialPort.isOpen()) {
                            debug("we clause because it was open");
                            this.serialPort.close();
                        }
                        debug("post event terminate with error");
                        this.evtTerminate.post(error);
                        return [2 /*return*/];
                }
            });
        }); });
        //this.serialPortAtParser.evtRawData.attach(rawAtMessages => debug(JSON.stringify(rawAtMessages).yellow));
        //this.evtUnsolicitedMessage.attach(atMessage => debug(JSON.stringify(atMessage, null, 2).yellow));
        this.serialPort.once("disconnect", function () {
            debug("disconnect");
            _this.evtTerminate.post(null);
        });
        this.serialPort.once("close", function () {
            debug("close, clear all timeout");
            _this.timers.clearAll();
            _this.serialPortAtParser.flush();
        });
        this.serialPort.evtError.attach(function (error) {
            debug("Serial port error: ", error);
            _this.evtError.post(error);
        });
        this.serialPort.on("data", function (atMessage, unparsed) {
            if (!atMessage) {
                _this.evtError.post(new ParseError(unparsed));
                return;
            }
            //debug(JSON.stringify(atMessage.id));
            if (atMessage.isUnsolicited)
                _this.evtUnsolicitedMessage.post(atMessage);
            else {
                _this.evtResponseAtMessage.post(atMessage);
            }
        });
    };
    AtStack.generateSafeRunParams = function (params) {
        if (!params)
            params = {};
        if (typeof params.recoverable !== "boolean")
            params.recoverable = false;
        if (typeof params.reportMode !== "number")
            params.reportMode = at_messages_parser_1.AtMessage.ReportMode.DEBUG_INFO_VERBOSE;
        switch (typeof params.retryOnErrors) {
            case "boolean": break;
            case "object":
                if (params.reportMode === at_messages_parser_1.AtMessage.ReportMode.NO_DEBUG_INFO)
                    params.retryOnErrors = false;
                break;
            default:
                if (params.reportMode === at_messages_parser_1.AtMessage.ReportMode.NO_DEBUG_INFO)
                    params.retryOnErrors = false;
                else
                    params.retryOnErrors = [14, 500];
        }
        if (!params.retryOnErrors)
            params.retryOnErrors = [];
        else if (typeof params.retryOnErrors === "boolean") {
            params.retryOnErrors = [];
            params.retryOnErrors.indexOf = function () {
                var inputs = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    inputs[_i] = arguments[_i];
                }
                return 0;
            };
        }
        return params;
    };
    AtStack.prototype.runCommandManageParams = function () {
        var inputs = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            inputs[_i] = arguments[_i];
        }
        return __awaiter(this, void 0, void 0, function () {
            var command, params, callback, _i, inputs_1, input, _a, resp, final, raw;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        command = undefined;
                        params = undefined;
                        callback = undefined;
                        for (_i = 0, inputs_1 = inputs; _i < inputs_1.length; _i++) {
                            input = inputs_1[_i];
                            switch (typeof input) {
                                case "string":
                                    command = input;
                                    break;
                                case "object":
                                    params = input;
                                    break;
                                case "function":
                                    callback = input;
                                    break;
                            }
                        }
                        return [4 /*yield*/, this.runCommandSetReportMode(command, AtStack.generateSafeRunParams(params))];
                    case 1:
                        _a = _b.sent(), resp = _a[0], final = _a[1], raw = _a[2];
                        callback(resp, final, raw);
                        return [2 /*return*/, null];
                }
            });
        });
    };
    AtStack.prototype.runCommandSetReportMode = function (command, params) {
        return __awaiter(this, void 0, void 0, function () {
            var reportMode, runOutputs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        reportMode = params.reportMode;
                        if (!(reportMode !== this.reportMode)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.runCommandSetEcho("AT+CMEE=" + reportMode + "\r", { "recoverable": false, "retryOnErrors": [] })];
                    case 1:
                        _a.sent();
                        this.reportMode = params.reportMode;
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.runCommandSetEcho(command, params)];
                    case 3:
                        runOutputs = _a.sent();
                        if (command.match(/(^ATZ\r$)|(^AT\+CMEE=\ ?[0-9]\r$)/))
                            this.reportMode = undefined;
                        return [2 /*return*/, runOutputs];
                }
            });
        });
    };
    AtStack.prototype.runCommandSetEcho = function (command, params) {
        return __awaiter(this, void 0, void 0, function () {
            var runOutputs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.isEchoEnable) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.runCommandRetry("ATE1\r", { "recoverable": false, "retryOnErrors": [] })];
                    case 1:
                        _a.sent();
                        this.isEchoEnable = true;
                        _a.label = 2;
                    case 2: return [4 /*yield*/, this.runCommandRetry(command, params)];
                    case 3:
                        runOutputs = _a.sent();
                        if (command.match(/^ATZ\r$/)) {
                            this.isEchoEnable = undefined;
                            this.hideEcho = false;
                        }
                        else if (command.match(/^ATE0\r$/)) {
                            this.isEchoEnable = false;
                            this.hideEcho = true;
                        }
                        else if (command.match(/^ATE1?\r$/)) {
                            this.isEchoEnable = true;
                            this.hideEcho = false;
                        }
                        return [2 /*return*/, runOutputs];
                }
            });
        });
    };
    AtStack.prototype.runCommandRetry = function (command, params) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var retryOnErrors, recoverable, _a, resp, final, raw, code;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        retryOnErrors = params.retryOnErrors, recoverable = params.recoverable;
                        return [4 /*yield*/, promisify.typed(this, this.runCommandBase)(command)];
                    case 1:
                        _a = _b.sent(), resp = _a[0], final = _a[1], raw = _a[2];
                        if (!final.isError) return [3 /*break*/, 7];
                        code = NaN;
                        if (final.id === at_messages_parser_1.AtMessage.idDict.COMMAND_NOT_SUPPORT ||
                            final.id === at_messages_parser_1.AtMessage.idDict.TOO_MANY_PARAMETERS)
                            this.retryLeft = 0;
                        else if (final.id === at_messages_parser_1.AtMessage.idDict.P_CME_ERROR ||
                            final.id === at_messages_parser_1.AtMessage.idDict.P_CMS_ERROR)
                            code = final.code;
                        if (!(!this.retryLeft-- || retryOnErrors.indexOf(code) < 0)) return [3 /*break*/, 4];
                        if (!!recoverable) return [3 /*break*/, 3];
                        this.evtError.post(new RunCommandError(command, final));
                        return [4 /*yield*/, new Promise(function (resolve) { })];
                    case 2:
                        _b.sent();
                        _b.label = 3;
                    case 3: return [3 /*break*/, 7];
                    case 4:
                        debug(("Retrying " + JSON.stringify(command) + " because " + JSON.stringify(final, null, 2)).yellow);
                        return [4 /*yield*/, new Promise(function (resolve) { return _this.timers.add(timer_extended_1.setTimeout(resolve, _this.delayBeforeRetry)); })];
                    case 5:
                        _b.sent();
                        return [4 /*yield*/, this.runCommandRetry(command, params)];
                    case 6: return [2 /*return*/, _b.sent()];
                    case 7:
                        this.retryLeft = this.maxRetry;
                        return [2 /*return*/, [resp, final, raw]];
                }
            });
        });
    };
    AtStack.prototype.runCommandBase = function (command, callback) {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            var echo, resp, final, writeAndDrainPromise, timer, atMessage, raw;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        echo = "";
                        resp = undefined;
                        writeAndDrainPromise = this.serialPort.writeAndDrain(command);
                        timer = this.timers.add(timer_extended_1.setTimeout(function () {
                            debug("Modem response timeout!".red);
                            _this.evtResponseAtMessage.stopWaiting();
                            var unparsed = _this.serialPortAtParser.flush();
                            if (unparsed) {
                                _this.serialPort.emit("data", null, unparsed);
                                return;
                            }
                            if (!_this.retryLeftWrite--) {
                                _this.evtError.post(new Error("Modem not responding"));
                                return;
                            }
                            debug("Retrying command " + JSON.stringify(command));
                            _this.runCommandBase(command, callback);
                        }, this.delayReWrite));
                        _a.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.evtResponseAtMessage.waitFor()];
                    case 2:
                        atMessage = _a.sent();
                        if (!timer.hasBeenCleared)
                            timer.clear();
                        if (atMessage.isFinal) {
                            final = atMessage;
                            return [3 /*break*/, 3];
                        }
                        else if (atMessage.id === at_messages_parser_1.AtMessage.idDict.ECHO)
                            echo += atMessage.raw;
                        else
                            resp = atMessage;
                        return [3 /*break*/, 1];
                    case 3: return [4 /*yield*/, writeAndDrainPromise];
                    case 4:
                        _a.sent();
                        raw = [
                            (this.hideEcho) ? "" : echo,
                            (resp) ? resp.raw : "",
                            final.raw
                        ].join("");
                        if (this.retryLeftWrite !== this.maxRetryWrite)
                            debug("Rewrite success!".green);
                        this.retryLeftWrite = this.maxRetryWrite;
                        callback(resp, final, raw);
                        return [2 /*return*/];
                }
            });
        });
    };
    return AtStack;
}());
exports.AtStack = AtStack;
var RunCommandError = (function (_super) {
    __extends(RunCommandError, _super);
    function RunCommandError(command, atMessageError) {
        var _this = _super.call(this, RunCommandError.name) || this;
        _this.command = command;
        _this.atMessageError = atMessageError;
        Object.setPrototypeOf(_this, RunCommandError.prototype);
        return _this;
    }
    return RunCommandError;
}(Error));
exports.RunCommandError = RunCommandError;
var ParseError = (function (_super) {
    __extends(ParseError, _super);
    function ParseError(unparsed) {
        var _this = _super.call(this, ParseError.name) || this;
        _this.unparsed = unparsed;
        Object.setPrototypeOf(_this, ParseError.prototype);
        return _this;
    }
    return ParseError;
}(Error));
exports.ParseError = ParseError;
//# sourceMappingURL=AtStack.js.map