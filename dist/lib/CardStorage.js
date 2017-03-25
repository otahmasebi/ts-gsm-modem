"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
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
var ts_events_extended_1 = require("ts-events-extended");
var ts_exec_queue_1 = require("ts-exec-queue");
var encoding = require("legacy-encoding");
var _debug = require("debug");
var debug = _debug("_CardStorage");
// cSpell:disable
var replaceArray = [
    [/[ÀÁÂÃÄ]/g, "A"],
    [/[àáâãä]/g, "a"],
    [/[ÈÉÊË]/g, "E"],
    [/[èéêë]/g, "e"],
    [/[ÌÍÎÏ]/g, "I"],
    [/[ìíîï]/g, "i"],
    [/[ÒÓÔÕÖ]/g, "O"],
    [/[òóôõö]/g, "o"],
    [/[ÙÚÛÜ]/g, "U"],
    [/[ùúûü]/g, "u"],
    [/[ÝŸ]/g, "Y"],
    [/[ýÿ]/g, "y"],
    [/[Ñ]/g, "N"],
    [/[ñ]/g, "n"],
    [/[\[{]/g, "("],
    [/[\]}]/g, ")"],
    [/_/g, "-"],
    [/@/g, "At"],
    [/["`]/g, "'"],
    [/[^a-zA-Z0-9\ <>!\&\*#%,;\.'\(\)\?-]/g, " "]
];
// cSpell:enable
var CardStorage = (function () {
    function CardStorage(atStack) {
        var _this = this;
        this.atStack = atStack;
        this.evtReady = new ts_events_extended_1.VoidSyncEvent();
        this.createContact = ts_exec_queue_1.execQueue("WRITE", function (number, name, callback) {
            var contact = {
                "index": _this.getFreeIndex(),
                "name": _this.generateSafeContactName(name),
                number: number
            };
            if (isNaN(contact.index)) {
                _this.atStack.evtError.post(new Error("Memory full"));
                return null;
            }
            //TODO check number valid
            if (contact.number.length > _this.numberMaxLength) {
                _this.atStack.evtError.post(Error("Number too long"));
                return null;
            }
            _this.atStack.runCommand("AT+CPBS=\"SM\"\r");
            _this.atStack.runCommand("AT+CSCS=\"IRA\"\r");
            _this.atStack.runCommand("AT+CPBW=" + contact.index + ",\"" + contact.number + "\",,\"" + contact.name + "\"\r", function () {
                _this.contactByIndex[contact.index] = contact;
                callback(_this.getContact(contact.index));
            });
            return null;
        });
        this.updateContact = ts_exec_queue_1.execQueue("WRITE", function (index, params, callback) {
            if (!_this.contactByIndex[index]) {
                _this.atStack.evtError.post(new Error("Contact does not exist"));
                return null;
            }
            if (typeof params.name === "undefined" && typeof params.number === "undefined") {
                _this.atStack.evtError.post(new Error("name and contact can not be both null"));
                return null;
            }
            var contact = _this.contactByIndex[index];
            var number = "";
            if (params.number !== undefined) {
                number = params.number;
                if (number.length > _this.numberMaxLength) {
                    _this.atStack.evtError.post(new Error("Number too long"));
                    return null;
                }
            }
            else
                number = contact.number;
            var contactName = "";
            var enc;
            if (params.name !== undefined) {
                enc = "IRA";
                contactName = _this.generateSafeContactName(params.name);
            }
            else {
                if (CardStorage.hasExtendedChar(contact.name)) {
                    enc = "UCS2";
                    contactName = CardStorage.encodeUCS2(contact.name);
                }
                else {
                    enc = "IRA";
                    contactName = _this.generateSafeContactName(contact.name);
                }
            }
            _this.atStack.runCommand("AT+CPBS=\"SM\"\r");
            _this.atStack.runCommand("AT+CSCS=\"" + enc + "\"\r");
            _this.atStack.runCommand("AT+CPBW=" + index + ",\"" + number + "\",,\"" + contactName + "\"\r", function () {
                _this.contactByIndex[index] = __assign({}, _this.contactByIndex[index], { number: number, "name": (enc === "UCS2") ? CardStorage.decodeUCS2(contactName) : contactName });
                callback(_this.getContact(index));
            });
            return null;
        });
        this.deleteContact = ts_exec_queue_1.execQueue("WRITE", function (index, callback) {
            if (!_this.contactByIndex[index]) {
                _this.atStack.evtError.post(new Error("Contact does not exists"));
                return null;
            }
            _this.atStack.runCommand("AT+CPBS=\"SM\"\r");
            _this.atStack.runCommand("AT+CPBW=" + index + "\r", function () {
                delete _this.contactByIndex[index];
                callback();
            });
            return null;
        });
        this.number = undefined;
        this.writeNumber = ts_exec_queue_1.execQueue("WRITE", function (number, callback) {
            _this.number = number;
            _this.atStack.runCommand("AT+CPBS=\"ON\"\r");
            _this.atStack.runCommand("AT+CPBW=1,\"" + number + "\"\r");
            _this.atStack.runCommand("AT+CPBS=\"SM\"\r", function () { return callback(); });
            return null;
        });
        this.contactByIndex = {};
        this.init().then(function () { return _this.evtReady.post(); });
    }
    Object.defineProperty(CardStorage.prototype, "isReady", {
        get: function () {
            return this.evtReady.postCount === 1;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CardStorage.prototype, "contacts", {
        get: function () {
            var out = [];
            for (var _i = 0, _a = Object.keys(this.contactByIndex); _i < _a.length; _i++) {
                var indexStr = _a[_i];
                var index = parseInt(indexStr);
                var contact = __assign({}, this.contactByIndex[index]);
                out.push(contact);
            }
            return out;
        },
        enumerable: true,
        configurable: true
    });
    CardStorage.prototype.getContact = function (index) {
        var contact = this.contactByIndex[index];
        return contact ? __assign({}, contact) : undefined;
    };
    Object.defineProperty(CardStorage.prototype, "contactNameMaxLength", {
        get: function () {
            return this.p_CPBR_TEST.tLength;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CardStorage.prototype, "numberMaxLength", {
        get: function () {
            return this.p_CPBR_TEST.nLength;
        },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(CardStorage.prototype, "storageLeft", {
        get: function () {
            var _a = this.p_CPBR_TEST.range, minIndex = _a[0], maxIndex = _a[1];
            var total = maxIndex - minIndex;
            return total - Object.keys(this.contactByIndex).length;
        },
        enumerable: true,
        configurable: true
    });
    CardStorage.prototype.generateSafeContactName = function (contactName) {
        for (var _i = 0, replaceArray_1 = replaceArray; _i < replaceArray_1.length; _i++) {
            var _a = replaceArray_1[_i], match = _a[0], replaceBy = _a[1];
            contactName = contactName.replace(match, replaceBy);
        }
        //TODO if tLength not even
        contactName = contactName.substring(0, this.contactNameMaxLength);
        if (contactName.length % 2 === 1)
            contactName += " ";
        return contactName;
    };
    CardStorage.prototype.getFreeIndex = function () {
        var _a = this.p_CPBR_TEST.range, minIndex = _a[0], maxIndex = _a[1];
        for (var index = minIndex; index <= maxIndex; index++)
            if (!this.contactByIndex[index])
                return index;
        return NaN;
    };
    CardStorage.prototype.init = function () {
        return __awaiter(this, void 0, void 0, function () {
            var resp, atMessageList, p_CNUM_EXEC, _a, minIndex, maxIndex, index, _b, resp_1, final, name_1, number, p_CPBR_EXEC, _c, resp_2, final_1, p_CPBR_EXEC, nameAsUcs2;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        debug("Init");
                        this.atStack.runCommand("AT+CSCS=\"UCS2\"\r");
                        return [4 /*yield*/, this.atStack.runCommand("AT+CNUM\r")];
                    case 1:
                        resp = (_d.sent())[0];
                        atMessageList = resp;
                        if (atMessageList.atMessages.length) {
                            p_CNUM_EXEC = atMessageList.atMessages[0];
                            this.number = p_CNUM_EXEC.number;
                        }
                        debug("number: " + this.number);
                        this.atStack.runCommand("AT+CPBS=\"SM\"\r");
                        return [4 /*yield*/, this.atStack.runCommand("AT+CPBR=?\r")];
                    case 2:
                        resp = (_d.sent())[0];
                        this.p_CPBR_TEST = resp;
                        _a = this.p_CPBR_TEST.range, minIndex = _a[0], maxIndex = _a[1];
                        index = minIndex;
                        _d.label = 3;
                    case 3:
                        if (!(index <= maxIndex)) return [3 /*break*/, 8];
                        this.atStack.runCommand("AT+CSCS=\"IRA\"\r");
                        return [4 /*yield*/, this.atStack.runCommand("AT+CPBR=" + index + "\r", { "recoverable": true })];
                    case 4:
                        _b = _d.sent(), resp_1 = _b[0], final = _b[1];
                        if (final.isError && final.code === 22)
                            return [3 /*break*/, 7];
                        name_1 = "\uFFFD";
                        number = "";
                        if (resp_1) {
                            p_CPBR_EXEC = resp_1;
                            name_1 = p_CPBR_EXEC.text;
                            number = p_CPBR_EXEC.number;
                        }
                        if (!(!resp_1 || CardStorage.countFFFD(name_1))) return [3 /*break*/, 6];
                        this.atStack.runCommand("AT+CSCS=\"UCS2\"\r");
                        return [4 /*yield*/, this.atStack.runCommand("AT+CPBR=" + index + "\r", { "recoverable": true })];
                    case 5:
                        _c = _d.sent(), resp_2 = _c[0], final_1 = _c[1];
                        if (!resp_2 && !number)
                            return [3 /*break*/, 7];
                        if (resp_2) {
                            p_CPBR_EXEC = resp_2;
                            nameAsUcs2 = CardStorage.decodeUCS2(p_CPBR_EXEC.text);
                            if (!number)
                                number = p_CPBR_EXEC.number;
                            if (CardStorage.printableLength(nameAsUcs2) > CardStorage.printableLength(name_1))
                                name_1 = nameAsUcs2;
                        }
                        _d.label = 6;
                    case 6:
                        this.contactByIndex[index] = { index: index, number: number, name: name_1 };
                        _d.label = 7;
                    case 7:
                        index++;
                        return [3 /*break*/, 3];
                    case 8:
                        debug("Contacts ready");
                        return [2 /*return*/];
                }
            });
        });
    };
    CardStorage.encodeUCS2 = function (text) {
        var buffer = encoding.encode(text, "ucs2");
        var hexStr = buffer.toString("hex");
        var length = hexStr.length;
        if (length >= 4)
            hexStr = hexStr.substring(length - 2, length) + hexStr.substring(0, length - 2);
        return hexStr;
    };
    CardStorage.decodeUCS2 = function (hexStr) {
        var length = hexStr.length;
        if (length >= 4)
            hexStr = hexStr.substring(2, length) + hexStr.substring(0, 2);
        var buffer = new Buffer(hexStr, "hex");
        return encoding.decode(buffer, "ucs2") || "";
    };
    CardStorage.printableLength = function (text) {
        return text.length - this.countFFFD(text) - this.countUnprintableChar(text);
    };
    CardStorage.countFFFD = function (text) {
        var match = text.match(/\uFFFD/g);
        if (!match)
            return 0;
        else
            return match.length;
    };
    CardStorage.countUnprintableChar = function (text) {
        var tmp = JSON.stringify(text);
        tmp = tmp.substring(1, tmp.length - 1);
        tmp = tmp.replace(/\\\\/g, "");
        var match = tmp.match(/\\/g);
        if (!match)
            return 0;
        else
            return match.length;
    };
    CardStorage.hasExtendedChar = function (text) {
        return text.match(/[^a-zA-Z0-9\ <>!\&\*#"%,;\.'\(\)\?-\uFFFD]/) !== null;
    };
    return CardStorage;
}());
exports.CardStorage = CardStorage;
//# sourceMappingURL=CardStorage.js.map