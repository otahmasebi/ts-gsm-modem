"use strict";
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
var at_messages_parser_1 = require("at-messages-parser");
var node_python_messaging_1 = require("node-python-messaging");
var ts_exec_queue_1 = require("ts-exec-queue");
var ts_events_extended_1 = require("ts-events-extended");
var timer_extended_1 = require("timer-extended");
var trackable_map_1 = require("trackable-map");
var _debug = require("debug");
var debug = _debug("_SmsStack");
require("colors");
var SmsStack = (function () {
    function SmsStack(atStack) {
        var _this = this;
        this.atStack = atStack;
        this.evtMessage = new ts_events_extended_1.SyncEvent();
        this.evtMessageStatusReport = new ts_events_extended_1.SyncEvent();
        this.evtSmsDeliver = new ts_events_extended_1.SyncEvent();
        this.evtSmsStatusReport = new ts_events_extended_1.SyncEvent();
        this.uncompletedMultipartSms = {};
        this.statusReportMap = {};
        this.mrMessageIdMap = {};
        this.maxTrySendPdu = 5;
        //TODO: More test for when message fail
        this.sendMessage = ts_exec_queue_1.execQueue(function (number, text, callback) { return __awaiter(_this, void 0, void 0, function () {
            var _a, error, pdus, messageId, _i, pdus_1, _b, length_1, pdu, mr, error_1, tryLeft, result, _c, _d, mr_1;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0: return [4 /*yield*/, node_python_messaging_1.buildSmsSubmitPdus({ number: number, text: text, "request_status": true })];
                    case 1:
                        _a = _e.sent(), error = _a[0], pdus = _a[1];
                        if (error) {
                            this.atStack.evtError.post(error);
                            return [2 /*return*/, NaN];
                        }
                        messageId = Date.now();
                        this.statusReportMap[messageId] = {
                            "cnt": pdus.length,
                            "completed": 0
                        };
                        _i = 0, pdus_1 = pdus;
                        _e.label = 2;
                    case 2:
                        if (!(_i < pdus_1.length)) return [3 /*break*/, 7];
                        _b = pdus_1[_i], length_1 = _b.length, pdu = _b.pdu;
                        mr = NaN;
                        error_1 = null;
                        tryLeft = this.maxTrySendPdu;
                        _e.label = 3;
                    case 3:
                        if (!(tryLeft-- && isNaN(mr))) return [3 /*break*/, 5];
                        if (tryLeft < this.maxTrySendPdu - 1)
                            console.log("Retry sending PDU".red);
                        return [4 /*yield*/, this.sendPdu(length_1, pdu)];
                    case 4:
                        result = _e.sent();
                        mr = result.mr;
                        error_1 = result.error;
                        return [3 /*break*/, 3];
                    case 5:
                        if (error_1) {
                            console.log(("Send Message Error after " + this.maxTrySendPdu + ", attempt: " + error_1.verbose).red);
                            for (_c = 0, _d = Object.keys(this.mrMessageIdMap); _c < _d.length; _c++) {
                                mr_1 = _d[_c];
                                if (this.mrMessageIdMap[mr_1] === messageId)
                                    delete this.mrMessageIdMap[mr_1];
                            }
                            callback(NaN);
                            return [2 /*return*/, NaN];
                        }
                        this.mrMessageIdMap[mr] = messageId;
                        _e.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 2];
                    case 7:
                        callback(messageId);
                        return [2 /*return*/, NaN];
                }
            });
        }); });
        atStack.runCommand('AT+CPMS="SM","SM","SM"\r');
        atStack.runCommand('AT+CNMI=1,1,0,2,0\r');
        this.registerListeners();
        this.retrieveUnreadSms();
    }
    SmsStack.prototype.retrieveUnreadSms = function () {
        return __awaiter(this, void 0, void 0, function () {
            var resp, atList, _i, _a, p_CMGL_SET, _b, error, sms;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, this.atStack.runCommand("AT+CMGL=" + at_messages_parser_1.AtMessage.MessageStat.ALL + "\r")];
                    case 1:
                        resp = (_c.sent())[0];
                        if (!resp)
                            return [2 /*return*/];
                        atList = resp;
                        _i = 0, _a = atList.atMessages;
                        _c.label = 2;
                    case 2:
                        if (!(_i < _a.length)) return [3 /*break*/, 5];
                        p_CMGL_SET = _a[_i];
                        if (p_CMGL_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_READ &&
                            p_CMGL_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_UNREAD) {
                            this.atStack.runCommand("AT+CMGD=" + p_CMGL_SET.index + "\r");
                            return [3 /*break*/, 4];
                        }
                        return [4 /*yield*/, node_python_messaging_1.decodePdu(p_CMGL_SET.pdu)];
                    case 3:
                        _b = _c.sent(), error = _b[0], sms = _b[1];
                        if (error || (sms instanceof node_python_messaging_1.SmsStatusReport)) {
                            if (error)
                                debug("PDU not decrypted: ".red, p_CMGL_SET.pdu, error);
                            this.atStack.runCommand("AT+CMGD=" + p_CMGL_SET.index + "\r");
                            return [3 /*break*/, 4];
                        }
                        this.evtSmsDeliver.post([p_CMGL_SET.index, sms]);
                        _c.label = 4;
                    case 4:
                        _i++;
                        return [3 /*break*/, 2];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    SmsStack.prototype.sendPdu = function (pduLength, pdu) {
        var _this = this;
        return new Promise(function (resolve) {
            _this.atStack.runCommand("AT+CMGS=" + pduLength + "\r");
            _this.atStack.runCommand(pdu + "\u001A", {
                "recoverable": true,
                "retryOnErrors": false
            }, function (resp, final) {
                if (!resp)
                    resolve({ "error": final, "mr": NaN });
                else
                    resolve({ "error": null, "mr": resp.mr });
            });
        });
    };
    SmsStack.prototype.registerListeners = function () {
        var _this = this;
        this.atStack.evtUnsolicitedMessage.attach(function (urc) {
            switch (urc.id) {
                case at_messages_parser_1.AtMessage.idDict.P_CMTI_URC:
                    _this.retrieveSms(urc.index);
                    break;
                case at_messages_parser_1.AtMessage.idDict.P_CDSI_URC:
                    _this.retrieveSms(urc.index);
                    break;
            }
        });
        this.evtSmsStatusReport.attach(function (smsStatusReport) {
            //console.log(JSON.stringify(smsStatusReport, null,2).blue);
            var messageId = _this.mrMessageIdMap[smsStatusReport.ref];
            if (!messageId)
                return;
            var isDelivered = true;
            switch (smsStatusReport._stClass) {
                case "RESERVED":
                case "STILL TRYING": return;
                case "PERMANENT ERROR":
                case "TEMPORARY ERROR":
                case "SPECIFIC TO SC":
                    isDelivered = false;
                    break;
                case "COMPLETED":
                    var elem = _this.statusReportMap[messageId];
                    if (++elem.completed !== elem.cnt)
                        return;
                    isDelivered = true;
                    break;
            }
            for (var _i = 0, _a = Object.keys(_this.mrMessageIdMap); _i < _a.length; _i++) {
                var mr = _a[_i];
                if (_this.mrMessageIdMap[mr] === messageId)
                    delete _this.mrMessageIdMap[mr];
            }
            delete _this.statusReportMap[messageId];
            _this.evtMessageStatusReport.post({
                messageId: messageId,
                "dischargeTime": smsStatusReport.sr.dt,
                isDelivered: isDelivered,
                "status": node_python_messaging_1.TP_ST[smsStatusReport.sr.status]
            });
        });
        this.evtSmsDeliver.attach(function (_a) {
            var index = _a[0], smsDeliver = _a[1];
            if (!(smsDeliver instanceof node_python_messaging_1.SmsDeliverPart)) {
                var number = smsDeliver.number, date = smsDeliver.date, text = smsDeliver.text;
                _this.evtMessage.post({ number: number, date: date, text: text });
                _this.atStack.runCommand("AT+CMGD=" + index + "\r");
                return;
            }
            var messageRef = smsDeliver.ref;
            var partRef = smsDeliver.seq;
            var totalPartInMessage = smsDeliver.cnt;
            var timer;
            var parts;
            if (!_this.uncompletedMultipartSms[messageRef]) {
                parts = {};
                timer = _this.atStack.timers.add(timer_extended_1.setTimeout(function (logMessage) {
                    debug(logMessage);
                    var partRefs = trackable_map_1.TrackableMap.intKeyAsSortedArray(parts);
                    var partRefPrev = 0;
                    var concatenatedText = "";
                    var partLeft = totalPartInMessage;
                    for (var _i = 0, partRefs_1 = partRefs; _i < partRefs_1.length; _i++) {
                        var partRef_1 = partRefs_1[_i];
                        var _a = parts[partRef_1], storageIndex = _a.storageIndex, text = _a.text;
                        for (var ref = partRefPrev + 1; ref < partRef_1; ref++) {
                            partLeft--;
                            concatenatedText += " *** Missing part *** ";
                        }
                        partLeft--;
                        concatenatedText += text;
                        _this.atStack.runCommand("AT+CMGD=" + storageIndex + "\r");
                        partRefPrev = partRef_1;
                    }
                    while (partLeft-- > 0)
                        concatenatedText += " *** Missing part *** ";
                    delete _this.uncompletedMultipartSms[messageRef];
                    var number = smsDeliver.number, date = smsDeliver.date;
                    _this.evtMessage.post({ number: number, date: date, "text": concatenatedText });
                }, 60000, "missing parts"));
                _this.uncompletedMultipartSms[messageRef] = { timer: timer, parts: parts };
            }
            else {
                timer = _this.uncompletedMultipartSms[messageRef].timer;
                parts = _this.uncompletedMultipartSms[messageRef].parts;
            }
            parts[partRef] = { "storageIndex": index, "text": smsDeliver.text };
            if (Object.keys(parts).length === totalPartInMessage)
                timer.runNow("message complete");
            else {
                debug("Message " + messageRef + ": " + Object.keys(parts).length + "/" + totalPartInMessage);
                timer.resetDelay();
            }
        });
    };
    SmsStack.prototype.retrieveSms = function (index) {
        return __awaiter(this, void 0, void 0, function () {
            var resp, p_CMGR_SET, _a, error, sms;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.atStack.runCommand("AT+CMGR=" + index + "\r")];
                    case 1:
                        resp = (_b.sent())[0];
                        if (!resp)
                            return [2 /*return*/];
                        p_CMGR_SET = resp;
                        if (p_CMGR_SET.stat !== at_messages_parser_1.AtMessage.MessageStat.REC_UNREAD)
                            return [2 /*return*/];
                        return [4 /*yield*/, node_python_messaging_1.decodePdu(p_CMGR_SET.pdu)];
                    case 2:
                        _a = _b.sent(), error = _a[0], sms = _a[1];
                        if (error) {
                            console.log("PDU not decrypted: ".red, p_CMGR_SET.pdu, error);
                            this.atStack.runCommand("AT+CMGD=" + index + "\r");
                            return [2 /*return*/];
                        }
                        switch (sms.type) {
                            case node_python_messaging_1.TP_MTI.SMS_DELIVER:
                                this.evtSmsDeliver.post([index, sms]);
                                return [2 /*return*/];
                            case node_python_messaging_1.TP_MTI.SMS_STATUS_REPORT:
                                this.evtSmsStatusReport.post(sms);
                                this.atStack.runCommand("AT+CMGD=" + index + "\r");
                                return [2 /*return*/];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    return SmsStack;
}());
exports.SmsStack = SmsStack;
//# sourceMappingURL=SmsStack.js.map