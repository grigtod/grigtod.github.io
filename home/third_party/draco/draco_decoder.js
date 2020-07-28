// Copyright 2016 The Draco Authors.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

var DracoDecoderModule = function(DracoDecoderModule) {
  DracoDecoderModule = DracoDecoderModule || {};
  var Module = DracoDecoderModule;

  var isRuntimeInitialized = false;
  var isModuleParsed = false;
  Module['onRuntimeInitialized'] = function() {
    isRuntimeInitialized = true;
    if (isModuleParsed) {
      if (typeof Module['onModuleLoaded'] === 'function') {
        Module['onModuleLoaded'](Module);
      }
    }
  };
  Module['onModuleParsed'] = function() {
    isModuleParsed = true;
    if (isRuntimeInitialized) {
      if (typeof Module['onModuleLoaded'] === 'function') {
        Module['onModuleLoaded'](Module);
      }
    }
  };
  function isVersionSupported(versionString) {
    if (typeof versionString !== 'string') return false;
    const version = versionString.split('.');
    if (version.length < 2 || version.length > 3) return false;
    if (version[0] == 1 && version[1] >= 0 && version[1] <= 2) return true;
    if (version[0] != 0 || version[1] > 10) return false;
    return true;
  }
  Module['isVersionSupported'] = isVersionSupported;
  var Module;
  if (!Module)
    Module =
      (typeof DracoDecoderModule !== 'undefined' ? DracoDecoderModule : null) ||
      {};
  var moduleOverrides = {};
  for (var key in Module) {
    if (Module.hasOwnProperty(key)) {
      moduleOverrides[key] = Module[key];
    }
  }
  var ENVIRONMENT_IS_WEB = false;
  var ENVIRONMENT_IS_WORKER = false;
  var ENVIRONMENT_IS_NODE = false;
  var ENVIRONMENT_IS_SHELL = false;
  if (Module['ENVIRONMENT']) {
    if (Module['ENVIRONMENT'] === 'WEB') {
      ENVIRONMENT_IS_WEB = true;
    } else if (Module['ENVIRONMENT'] === 'WORKER') {
      ENVIRONMENT_IS_WORKER = true;
    } else if (Module['ENVIRONMENT'] === 'NODE') {
      ENVIRONMENT_IS_NODE = true;
    } else if (Module['ENVIRONMENT'] === 'SHELL') {
      ENVIRONMENT_IS_SHELL = true;
    } else {
      throw new Error(
        "The provided Module['ENVIRONMENT'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL."
      );
    }
  } else {
    ENVIRONMENT_IS_WEB = typeof window === 'object';
    ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
    ENVIRONMENT_IS_NODE =
      typeof process === 'object' &&
      typeof require === 'function' &&
      !ENVIRONMENT_IS_WEB &&
      !ENVIRONMENT_IS_WORKER;
    ENVIRONMENT_IS_SHELL =
      !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
  }
  if (ENVIRONMENT_IS_NODE) {
    if (!Module['print']) Module['print'] = console.log;
    if (!Module['printErr']) Module['printErr'] = console.warn;
    var nodeFS;
    var nodePath;
    Module['read'] = function shell_read(filename, binary) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      var ret = nodeFS['readFileSync'](filename);
      return binary ? ret : ret.toString();
    };
    Module['readBinary'] = function readBinary(filename) {
      var ret = Module['read'](filename, true);
      if (!ret.buffer) {
        ret = new Uint8Array(ret);
      }
      assert(ret.buffer);
      return ret;
    };
    Module['load'] = function load(f) {
      globalEval(read(f));
    };
    if (!Module['thisProgram']) {
      if (process['argv'].length > 1) {
        Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
      } else {
        Module['thisProgram'] = 'unknown-program';
      }
    }
    Module['arguments'] = process['argv'].slice(2);
    if (typeof module !== 'undefined') {
      module['exports'] = Module;
    }
    process['on']('uncaughtException', function(ex) {
      if (!(ex instanceof ExitStatus)) {
        throw ex;
      }
    });
    Module['inspect'] = function() {
      return '[Emscripten Module object]';
    };
  } else if (ENVIRONMENT_IS_SHELL) {
    if (!Module['print']) Module['print'] = print;
    if (typeof printErr != 'undefined') Module['printErr'] = printErr;
    if (typeof read != 'undefined') {
      Module['read'] = read;
    } else {
      Module['read'] = function shell_read() {
        throw 'no read() available';
      };
    }
    Module['readBinary'] = function readBinary(f) {
      if (typeof readbuffer === 'function') {
        return new Uint8Array(readbuffer(f));
      }
      var data = read(f, 'binary');
      assert(typeof data === 'object');
      return data;
    };
    if (typeof scriptArgs != 'undefined') {
      Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
    if (typeof quit === 'function') {
      Module['quit'] = function(status, toThrow) {
        quit(status);
      };
    }
  } else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
    };
    if (ENVIRONMENT_IS_WORKER) {
      Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
      };
    }
    Module['readAsync'] = function readAsync(url, onload, onerror) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.onload = function xhr_onload() {
        if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) {
          onload(xhr.response);
        } else {
          onerror();
        }
      };
      xhr.onerror = onerror;
      xhr.send(null);
    };
    if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
    if (typeof console !== 'undefined') {
      if (!Module['print'])
        Module['print'] = function shell_print(x) {
          console.log(x);
        };
      if (!Module['printErr'])
        Module['printErr'] = function shell_printErr(x) {
          console.warn(x);
        };
    } else {
      var TRY_USE_DUMP = false;
      if (!Module['print'])
        Module['print'] = TRY_USE_DUMP && typeof dump !== 'undefined'
          ? function(x) {
              dump(x);
            }
          : function(x) {};
    }
    if (ENVIRONMENT_IS_WORKER) {
      Module['load'] = importScripts;
    }
    if (typeof Module['setWindowTitle'] === 'undefined') {
      Module['setWindowTitle'] = function(title) {
        document.title = title;
      };
    }
  } else {
    throw 'Unknown runtime environment. Where are we?';
  }
  function globalEval(x) {
    eval.call(null, x);
  }
  if (!Module['load'] && Module['read']) {
    Module['load'] = function load(f) {
      globalEval(Module['read'](f));
    };
  }
  if (!Module['print']) {
    Module['print'] = function() {};
  }
  if (!Module['printErr']) {
    Module['printErr'] = Module['print'];
  }
  if (!Module['arguments']) {
    Module['arguments'] = [];
  }
  if (!Module['thisProgram']) {
    Module['thisProgram'] = './this.program';
  }
  if (!Module['quit']) {
    Module['quit'] = function(status, toThrow) {
      throw toThrow;
    };
  }
  Module.print = Module['print'];
  Module.printErr = Module['printErr'];
  Module['preRun'] = [];
  Module['postRun'] = [];
  for (var key in moduleOverrides) {
    if (moduleOverrides.hasOwnProperty(key)) {
      Module[key] = moduleOverrides[key];
    }
  }
  moduleOverrides = undefined;
  var Runtime = {
    setTempRet0: function(value) {
      tempRet0 = value;
      return value;
    },
    getTempRet0: function() {
      return tempRet0;
    },
    stackSave: function() {
      return STACKTOP;
    },
    stackRestore: function(stackTop) {
      STACKTOP = stackTop;
    },
    getNativeTypeSize: function(type) {
      switch (type) {
        case 'i1':
        case 'i8':
          return 1;
        case 'i16':
          return 2;
        case 'i32':
          return 4;
        case 'i64':
          return 8;
        case 'float':
          return 4;
        case 'double':
          return 8;
        default: {
          if (type[type.length - 1] === '*') {
            return Runtime.QUANTUM_SIZE;
          } else if (type[0] === 'i') {
            var bits = parseInt(type.substr(1));
            assert(bits % 8 === 0);
            return bits / 8;
          } else {
            return 0;
          }
        }
      }
    },
    getNativeFieldSize: function(type) {
      return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
    },
    STACK_ALIGN: 16,
    prepVararg: function(ptr, type) {
      if (type === 'double' || type === 'i64') {
        if (ptr & 7) {
          assert((ptr & 7) === 4);
          ptr += 4;
        }
      } else {
        assert((ptr & 3) === 0);
      }
      return ptr;
    },
    getAlignSize: function(type, size, vararg) {
      if (!vararg && (type == 'i64' || type == 'double')) return 8;
      if (!type) return Math.min(size, 8);
      return Math.min(
        size || (type ? Runtime.getNativeFieldSize(type) : 0),
        Runtime.QUANTUM_SIZE
      );
    },
    dynCall: function(sig, ptr, args) {
      if (args && args.length) {
        return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
      } else {
        return Module['dynCall_' + sig].call(null, ptr);
      }
    },
    functionPointers: [],
    addFunction: function(func) {
      for (var i = 0; i < Runtime.functionPointers.length; i++) {
        if (!Runtime.functionPointers[i]) {
          Runtime.functionPointers[i] = func;
          return 2 * (1 + i);
        }
      }
      throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
    },
    removeFunction: function(index) {
      Runtime.functionPointers[(index - 2) / 2] = null;
    },
    warnOnce: function(text) {
      if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
      if (!Runtime.warnOnce.shown[text]) {
        Runtime.warnOnce.shown[text] = 1;
        Module.printErr(text);
      }
    },
    funcWrappers: {},
    getFuncWrapper: function(func, sig) {
      assert(sig);
      if (!Runtime.funcWrappers[sig]) {
        Runtime.funcWrappers[sig] = {};
      }
      var sigCache = Runtime.funcWrappers[sig];
      if (!sigCache[func]) {
        if (sig.length === 1) {
          sigCache[func] = function dynCall_wrapper() {
            return Runtime.dynCall(sig, func);
          };
        } else if (sig.length === 2) {
          sigCache[func] = function dynCall_wrapper(arg) {
            return Runtime.dynCall(sig, func, [arg]);
          };
        } else {
          sigCache[func] = function dynCall_wrapper() {
            return Runtime.dynCall(
              sig,
              func,
              Array.prototype.slice.call(arguments)
            );
          };
        }
      }
      return sigCache[func];
    },
    getCompilerSetting: function(name) {
      throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
    },
    stackAlloc: function(size) {
      var ret = STACKTOP;
      STACKTOP = (STACKTOP + size) | 0;
      STACKTOP = (STACKTOP + 15) & -16;
      return ret;
    },
    staticAlloc: function(size) {
      var ret = STATICTOP;
      STATICTOP = (STATICTOP + size) | 0;
      STATICTOP = (STATICTOP + 15) & -16;
      return ret;
    },
    dynamicAlloc: function(size) {
      var ret = HEAP32[DYNAMICTOP_PTR >> 2];
      var end = ((ret + size + 15) | 0) & -16;
      HEAP32[DYNAMICTOP_PTR >> 2] = end;
      if (end >= TOTAL_MEMORY) {
        var success = enlargeMemory();
        if (!success) {
          HEAP32[DYNAMICTOP_PTR >> 2] = ret;
          return 0;
        }
      }
      return ret;
    },
    alignMemory: function(size, quantum) {
      var ret = (size =
        Math.ceil(size / (quantum ? quantum : 16)) * (quantum ? quantum : 16));
      return ret;
    },
    makeBigInt: function(low, high, unsigned) {
      var ret = unsigned
        ? +(low >>> 0) + +(high >>> 0) * +4294967296
        : +(low >>> 0) + +(high | 0) * +4294967296;
      return ret;
    },
    GLOBAL_BASE: 8,
    QUANTUM_SIZE: 4,
    __dummy__: 0,
  };
  var ABORT = 0;
  var EXITSTATUS = 0;
  function assert(condition, text) {
    if (!condition) {
      abort('Assertion failed: ' + text);
    }
  }
  function getCFunc(ident) {
    var func = Module['_' + ident];
    if (!func) {
      try {
        func = eval('_' + ident);
      } catch (e) {}
    }
    assert(
      func,
      'Cannot call unknown function ' +
        ident +
        ' (perhaps LLVM optimizations or closure removed it?)'
    );
    return func;
  }
  var ccall;
  (function() {
    var JSfuncs = {
      stackSave: function() {
        Runtime.stackSave();
      },
      stackRestore: function() {
        Runtime.stackRestore();
      },
      arrayToC: function(arr) {
        var ret = Runtime.stackAlloc(arr.length);
        writeArrayToMemory(arr, ret);
        return ret;
      },
      stringToC: function(str) {
        var ret = 0;
        if (str !== null && str !== undefined && str !== 0) {
          var len = (str.length << 2) + 1;
          ret = Runtime.stackAlloc(len);
          stringToUTF8(str, ret, len);
        }
        return ret;
      },
    };
    var toC = { string: JSfuncs['stringToC'], array: JSfuncs['arrayToC'] };
    ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
      var func = getCFunc(ident);
      var cArgs = [];
      var stack = 0;
      if (args) {
        for (var i = 0; i < args.length; i++) {
          var converter = toC[argTypes[i]];
          if (converter) {
            if (stack === 0) stack = Runtime.stackSave();
            cArgs[i] = converter(args[i]);
          } else {
            cArgs[i] = args[i];
          }
        }
      }
      var ret = func.apply(null, cArgs);
      if (returnType === 'string') ret = Pointer_stringify(ret);
      if (stack !== 0) {
        if (opts && opts.async) {
          EmterpreterAsync.asyncFinalizers.push(function() {
            Runtime.stackRestore(stack);
          });
          return;
        }
        Runtime.stackRestore(stack);
      }
      return ret;
    };
    var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
    function parseJSFunc(jsfunc) {
      var parsed = jsfunc.toString().match(sourceRegex).slice(1);
      return { arguments: parsed[0], body: parsed[1], returnValue: parsed[2] };
    }
    var JSsource = null;
    function ensureJSsource() {
      if (!JSsource) {
        JSsource = {};
        for (var fun in JSfuncs) {
          if (JSfuncs.hasOwnProperty(fun)) {
            JSsource[fun] = parseJSFunc(JSfuncs[fun]);
          }
        }
      }
    }
    cwrap = function cwrap(ident, returnType, argTypes) {
      argTypes = argTypes || [];
      var cfunc = getCFunc(ident);
      var numericArgs = argTypes.every(function(type) {
        return type === 'number';
      });
      var numericRet = returnType !== 'string';
      if (numericRet && numericArgs) {
        return cfunc;
      }
      var argNames = argTypes.map(function(x, i) {
        return '$' + i;
      });
      var funcstr = '(function(' + argNames.join(',') + ') {';
      var nargs = argTypes.length;
      if (!numericArgs) {
        ensureJSsource();
        funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
        for (var i = 0; i < nargs; i++) {
          var arg = argNames[i],
            type = argTypes[i];
          if (type === 'number') continue;
          var convertCode = JSsource[type + 'ToC'];
          funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
          funcstr += convertCode.body + ';';
          funcstr += arg + '=(' + convertCode.returnValue + ');';
        }
      }
      var cfuncname = parseJSFunc(function() {
        return cfunc;
      }).returnValue;
      funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
      if (!numericRet) {
        var strgfy = parseJSFunc(function() {
          return Pointer_stringify;
        }).returnValue;
        funcstr += 'ret = ' + strgfy + '(ret);';
      }
      if (!numericArgs) {
        ensureJSsource();
        funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
      }
      funcstr += 'return ret})';
      return eval(funcstr);
    };
  })();
  function setValue(ptr, value, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length - 1) === '*') type = 'i32';
    switch (type) {
      case 'i1':
        HEAP8[ptr >> 0] = value;
        break;
      case 'i8':
        HEAP8[ptr >> 0] = value;
        break;
      case 'i16':
        HEAP16[ptr >> 1] = value;
        break;
      case 'i32':
        HEAP32[ptr >> 2] = value;
        break;
      case 'i64':
        (tempI64 = [
          value >>> 0,
          (
            (tempDouble = value),
            +Math_abs(tempDouble) >= +1
              ? tempDouble > +0
                ? (Math_min(
                    +Math_floor(tempDouble / +4294967296),
                    +4294967295
                  ) |
                    0) >>>
                    0
                : ~~+Math_ceil(
                    (tempDouble - +(~~tempDouble >>> 0)) / +4294967296
                  ) >>> 0
              : 0
          ),
        ]), (HEAP32[ptr >> 2] = tempI64[0]), (HEAP32[(ptr + 4) >> 2] =
          tempI64[1]);
        break;
      case 'float':
        HEAPF32[ptr >> 2] = value;
        break;
      case 'double':
        HEAPF64[ptr >> 3] = value;
        break;
      default:
        abort('invalid type for setValue: ' + type);
    }
  }
  function getValue(ptr, type, noSafe) {
    type = type || 'i8';
    if (type.charAt(type.length - 1) === '*') type = 'i32';
    switch (type) {
      case 'i1':
        return HEAP8[ptr >> 0];
      case 'i8':
        return HEAP8[ptr >> 0];
      case 'i16':
        return HEAP16[ptr >> 1];
      case 'i32':
        return HEAP32[ptr >> 2];
      case 'i64':
        return HEAP32[ptr >> 2];
      case 'float':
        return HEAPF32[ptr >> 2];
      case 'double':
        return HEAPF64[ptr >> 3];
      default:
        abort('invalid type for setValue: ' + type);
    }
    return null;
  }
  var ALLOC_NORMAL = 0;
  var ALLOC_STATIC = 2;
  var ALLOC_NONE = 4;
  function allocate(slab, types, allocator, ptr) {
    var zeroinit, size;
    if (typeof slab === 'number') {
      zeroinit = true;
      size = slab;
    } else {
      zeroinit = false;
      size = slab.length;
    }
    var singleType = typeof types === 'string' ? types : null;
    var ret;
    if (allocator == ALLOC_NONE) {
      ret = ptr;
    } else {
      ret = [
        typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc,
        Runtime.stackAlloc,
        Runtime.staticAlloc,
        Runtime.dynamicAlloc,
      ][allocator === undefined ? ALLOC_STATIC : allocator](
        Math.max(size, singleType ? 1 : types.length)
      );
    }
    if (zeroinit) {
      var ptr = ret,
        stop;
      assert((ret & 3) == 0);
      stop = ret + (size & ~3);
      for (; ptr < stop; ptr += 4) {
        HEAP32[ptr >> 2] = 0;
      }
      stop = ret + size;
      while (ptr < stop) {
        HEAP8[ptr++ >> 0] = 0;
      }
      return ret;
    }
    if (singleType === 'i8') {
      if (slab.subarray || slab.slice) {
        HEAPU8.set(slab, ret);
      } else {
        HEAPU8.set(new Uint8Array(slab), ret);
      }
      return ret;
    }
    var i = 0,
      type,
      typeSize,
      previousType;
    while (i < size) {
      var curr = slab[i];
      if (typeof curr === 'function') {
        curr = Runtime.getFunctionIndex(curr);
      }
      type = singleType || types[i];
      if (type === 0) {
        i++;
        continue;
      }
      if (type == 'i64') type = 'i32';
      setValue(ret + i, curr, type);
      if (previousType !== type) {
        typeSize = Runtime.getNativeTypeSize(type);
        previousType = type;
      }
      i += typeSize;
    }
    return ret;
  }
  function Pointer_stringify(ptr, length) {
    if (length === 0 || !ptr) return '';
    var hasUtf = 0;
    var t;
    var i = 0;
    while (1) {
      t = HEAPU8[(ptr + i) >> 0];
      hasUtf |= t;
      if (t == 0 && !length) break;
      i++;
      if (length && i == length) break;
    }
    if (!length) length = i;
    var ret = '';
    if (hasUtf < 128) {
      var MAX_CHUNK = 1024;
      var curr;
      while (length > 0) {
        curr = String.fromCharCode.apply(
          String,
          HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK))
        );
        ret = ret ? ret + curr : curr;
        ptr += MAX_CHUNK;
        length -= MAX_CHUNK;
      }
      return ret;
    }
    return Module['UTF8ToString'](ptr);
  }
  var UTF8Decoder = typeof TextDecoder !== 'undefined'
    ? new TextDecoder('utf8')
    : undefined;
  function UTF8ArrayToString(u8Array, idx) {
    var endPtr = idx;
    while (u8Array[endPtr]) ++endPtr;
    if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
      return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
    } else {
      var u0, u1, u2, u3, u4, u5;
      var str = '';
      while (1) {
        u0 = u8Array[idx++];
        if (!u0) return str;
        if (!(u0 & 128)) {
          str += String.fromCharCode(u0);
          continue;
        }
        u1 = u8Array[idx++] & 63;
        if ((u0 & 224) == 192) {
          str += String.fromCharCode(((u0 & 31) << 6) | u1);
          continue;
        }
        u2 = u8Array[idx++] & 63;
        if ((u0 & 240) == 224) {
          u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
        } else {
          u3 = u8Array[idx++] & 63;
          if ((u0 & 248) == 240) {
            u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
          } else {
            u4 = u8Array[idx++] & 63;
            if ((u0 & 252) == 248) {
              u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
            } else {
              u5 = u8Array[idx++] & 63;
              u0 =
                ((u0 & 1) << 30) |
                (u1 << 24) |
                (u2 << 18) |
                (u3 << 12) |
                (u4 << 6) |
                u5;
            }
          }
        }
        if (u0 < 65536) {
          str += String.fromCharCode(u0);
        } else {
          var ch = u0 - 65536;
          str += String.fromCharCode(55296 | (ch >> 10), 56320 | (ch & 1023));
        }
      }
    }
  }
  function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343)
        u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        outU8Array[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        outU8Array[outIdx++] = 192 | (u >> 6);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        outU8Array[outIdx++] = 224 | (u >> 12);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 2097151) {
        if (outIdx + 3 >= endIdx) break;
        outU8Array[outIdx++] = 240 | (u >> 18);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else if (u <= 67108863) {
        if (outIdx + 4 >= endIdx) break;
        outU8Array[outIdx++] = 248 | (u >> 24);
        outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      } else {
        if (outIdx + 5 >= endIdx) break;
        outU8Array[outIdx++] = 252 | (u >> 30);
        outU8Array[outIdx++] = 128 | ((u >> 24) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 18) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 12) & 63);
        outU8Array[outIdx++] = 128 | ((u >> 6) & 63);
        outU8Array[outIdx++] = 128 | (u & 63);
      }
    }
    outU8Array[outIdx] = 0;
    return outIdx - startIdx;
  }
  function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  }
  function lengthBytesUTF8(str) {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var u = str.charCodeAt(i);
      if (u >= 55296 && u <= 57343)
        u = (65536 + ((u & 1023) << 10)) | (str.charCodeAt(++i) & 1023);
      if (u <= 127) {
        ++len;
      } else if (u <= 2047) {
        len += 2;
      } else if (u <= 65535) {
        len += 3;
      } else if (u <= 2097151) {
        len += 4;
      } else if (u <= 67108863) {
        len += 5;
      } else {
        len += 6;
      }
    }
    return len;
  }
  var UTF16Decoder = typeof TextDecoder !== 'undefined'
    ? new TextDecoder('utf-16le')
    : undefined;
  function demangle(func) {
    var __cxa_demangle_func =
      Module['___cxa_demangle'] || Module['__cxa_demangle'];
    if (__cxa_demangle_func) {
      try {
        var s = func.substr(1);
        var len = lengthBytesUTF8(s) + 1;
        var buf = _malloc(len);
        stringToUTF8(s, buf, len);
        var status = _malloc(4);
        var ret = __cxa_demangle_func(buf, 0, 0, status);
        if (getValue(status, 'i32') === 0 && ret) {
          return Pointer_stringify(ret);
        }
      } catch (e) {
      } finally {
        if (buf) _free(buf);
        if (status) _free(status);
        if (ret) _free(ret);
      }
      return func;
    }
    Runtime.warnOnce(
      'warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling'
    );
    return func;
  }
  function demangleAll(text) {
    var regex = /__Z[\w\d_]+/g;
    return text.replace(regex, function(x) {
      var y = demangle(x);
      return x === y ? x : x + ' [' + y + ']';
    });
  }
  function jsStackTrace() {
    var err = new Error();
    if (!err.stack) {
      try {
        throw new Error(0);
      } catch (e) {
        err = e;
      }
      if (!err.stack) {
        return '(no stack trace available)';
      }
    }
    return err.stack.toString();
  }
  function stackTrace() {
    var js = jsStackTrace();
    if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
    return demangleAll(js);
  }
  var WASM_PAGE_SIZE = 65536;
  var ASMJS_PAGE_SIZE = 16777216;
  var MIN_TOTAL_MEMORY = 16777216;
  function alignUp(x, multiple) {
    if (x % multiple > 0) {
      x += multiple - x % multiple;
    }
    return x;
  }
  var HEAP,
    buffer,
    HEAP8,
    HEAPU8,
    HEAP16,
    HEAPU16,
    HEAP32,
    HEAPU32,
    HEAPF32,
    HEAPF64;
  function updateGlobalBuffer(buf) {
    Module['buffer'] = buffer = buf;
  }
  function updateGlobalBufferViews() {
    Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
    Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
    Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
    Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
    Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
    Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
    Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
    Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
  }
  var STATIC_BASE, STATICTOP, staticSealed;
  var STACK_BASE, STACKTOP, STACK_MAX;
  var DYNAMIC_BASE, DYNAMICTOP_PTR;
  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;
  function abortOnCannotGrowMemory() {
    abort(
      'Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' +
        TOTAL_MEMORY +
        ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 '
    );
  }
  if (!Module['reallocBuffer'])
    Module['reallocBuffer'] = function(size) {
      var ret;
      try {
        if (ArrayBuffer.transfer) {
          ret = ArrayBuffer.transfer(buffer, size);
        } else {
          var oldHEAP8 = HEAP8;
          ret = new ArrayBuffer(size);
          var temp = new Int8Array(ret);
          temp.set(oldHEAP8);
        }
      } catch (e) {
        return false;
      }
      var success = _emscripten_replace_memory(ret);
      if (!success) return false;
      return ret;
    };
  function enlargeMemory() {
    var PAGE_MULTIPLE = Module['usingWasm'] ? WASM_PAGE_SIZE : ASMJS_PAGE_SIZE;
    var LIMIT = 2147483648 - PAGE_MULTIPLE;
    if (HEAP32[DYNAMICTOP_PTR >> 2] > LIMIT) {
      return false;
    }
    var OLD_TOTAL_MEMORY = TOTAL_MEMORY;
    TOTAL_MEMORY = Math.max(TOTAL_MEMORY, MIN_TOTAL_MEMORY);
    while (TOTAL_MEMORY < HEAP32[DYNAMICTOP_PTR >> 2]) {
      if (TOTAL_MEMORY <= 536870912) {
        TOTAL_MEMORY = alignUp(2 * TOTAL_MEMORY, PAGE_MULTIPLE);
      } else {
        TOTAL_MEMORY = Math.min(
          alignUp((3 * TOTAL_MEMORY + 2147483648) / 4, PAGE_MULTIPLE),
          LIMIT
        );
      }
    }
    var replacement = Module['reallocBuffer'](TOTAL_MEMORY);
    if (!replacement || replacement.byteLength != TOTAL_MEMORY) {
      TOTAL_MEMORY = OLD_TOTAL_MEMORY;
      return false;
    }
    updateGlobalBuffer(replacement);
    updateGlobalBufferViews();
    return true;
  }
  var byteLength;
  try {
    byteLength = Function.prototype.call.bind(
      Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, 'byteLength').get
    );
    byteLength(new ArrayBuffer(4));
  } catch (e) {
    byteLength = function(buffer) {
      return buffer.byteLength;
    };
  }
  var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
  var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
  if (TOTAL_MEMORY < TOTAL_STACK)
    Module.printErr(
      'TOTAL_MEMORY should be larger than TOTAL_STACK, was ' +
        TOTAL_MEMORY +
        '! (TOTAL_STACK=' +
        TOTAL_STACK +
        ')'
    );
  if (Module['buffer']) {
    buffer = Module['buffer'];
  } else {
    {
      buffer = new ArrayBuffer(TOTAL_MEMORY);
    }
  }
  updateGlobalBufferViews();
  function getTotalMemory() {
    return TOTAL_MEMORY;
  }
  HEAP32[0] = 1668509029;
  HEAP16[1] = 25459;
  if (HEAPU8[2] !== 115 || HEAPU8[3] !== 99)
    throw 'Runtime error: expected the system to be little-endian!';
  Module['HEAP'] = HEAP;
  Module['buffer'] = buffer;
  Module['HEAP8'] = HEAP8;
  Module['HEAP16'] = HEAP16;
  Module['HEAP32'] = HEAP32;
  Module['HEAPU8'] = HEAPU8;
  Module['HEAPU16'] = HEAPU16;
  Module['HEAPU32'] = HEAPU32;
  Module['HEAPF32'] = HEAPF32;
  Module['HEAPF64'] = HEAPF64;
  function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
      var callback = callbacks.shift();
      if (typeof callback == 'function') {
        callback();
        continue;
      }
      var func = callback.func;
      if (typeof func === 'number') {
        if (callback.arg === undefined) {
          Module['dynCall_v'](func);
        } else {
          Module['dynCall_vi'](func, callback.arg);
        }
      } else {
        func(callback.arg === undefined ? null : callback.arg);
      }
    }
  }
  var __ATPRERUN__ = [];
  var __ATINIT__ = [];
  var __ATMAIN__ = [];
  var __ATEXIT__ = [];
  var __ATPOSTRUN__ = [];
  var runtimeInitialized = false;
  var runtimeExited = false;
  function preRun() {
    if (Module['preRun']) {
      if (typeof Module['preRun'] == 'function')
        Module['preRun'] = [Module['preRun']];
      while (Module['preRun'].length) {
        addOnPreRun(Module['preRun'].shift());
      }
    }
    callRuntimeCallbacks(__ATPRERUN__);
  }
  function ensureInitRuntime() {
    if (runtimeInitialized) return;
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__);
  }
  function preMain() {
    callRuntimeCallbacks(__ATMAIN__);
  }
  function exitRuntime() {
    callRuntimeCallbacks(__ATEXIT__);
    runtimeExited = true;
  }
  function postRun() {
    if (Module['postRun']) {
      if (typeof Module['postRun'] == 'function')
        Module['postRun'] = [Module['postRun']];
      while (Module['postRun'].length) {
        addOnPostRun(Module['postRun'].shift());
      }
    }
    callRuntimeCallbacks(__ATPOSTRUN__);
  }
  function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb);
  }
  function addOnPreMain(cb) {
    __ATMAIN__.unshift(cb);
  }
  function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb);
  }
  function intArrayFromString(stringy, dontAddNull, length) {
    var len = length > 0 ? length : lengthBytesUTF8(stringy) + 1;
    var u8array = new Array(len);
    var numBytesWritten = stringToUTF8Array(
      stringy,
      u8array,
      0,
      u8array.length
    );
    if (dontAddNull) u8array.length = numBytesWritten;
    return u8array;
  }
  function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer);
  }
  function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (var i = 0; i < str.length; ++i) {
      HEAP8[buffer++ >> 0] = str.charCodeAt(i);
    }
    if (!dontAddNull) HEAP8[buffer >> 0] = 0;
  }
  if (!Math['imul'] || Math['imul'](4294967295, 5) !== -5)
    Math['imul'] = function imul(a, b) {
      var ah = a >>> 16;
      var al = a & 65535;
      var bh = b >>> 16;
      var bl = b & 65535;
      return (al * bl + ((ah * bl + al * bh) << 16)) | 0;
    };
  Math.imul = Math['imul'];
  if (!Math['fround']) {
    var froundBuffer = new Float32Array(1);
    Math['fround'] = function(x) {
      froundBuffer[0] = x;
      return froundBuffer[0];
    };
  }
  Math.fround = Math['fround'];
  if (!Math['clz32'])
    Math['clz32'] = function(x) {
      x = x >>> 0;
      for (var i = 0; i < 32; i++) {
        if (x & (1 << (31 - i))) return i;
      }
      return 32;
    };
  Math.clz32 = Math['clz32'];
  if (!Math['trunc'])
    Math['trunc'] = function(x) {
      return x < 0 ? Math.ceil(x) : Math.floor(x);
    };
  Math.trunc = Math['trunc'];
  var Math_abs = Math.abs;
  var Math_cos = Math.cos;
  var Math_sin = Math.sin;
  var Math_tan = Math.tan;
  var Math_acos = Math.acos;
  var Math_asin = Math.asin;
  var Math_atan = Math.atan;
  var Math_atan2 = Math.atan2;
  var Math_exp = Math.exp;
  var Math_log = Math.log;
  var Math_sqrt = Math.sqrt;
  var Math_ceil = Math.ceil;
  var Math_floor = Math.floor;
  var Math_pow = Math.pow;
  var Math_imul = Math.imul;
  var Math_fround = Math.fround;
  var Math_round = Math.round;
  var Math_min = Math.min;
  var Math_clz32 = Math.clz32;
  var Math_trunc = Math.trunc;
  var runDependencies = 0;
  var runDependencyWatcher = null;
  var dependenciesFulfilled = null;
  Module['preloadedImages'] = {};
  Module['preloadedAudios'] = {};
  var ASM_CONSTS = [];
  STATIC_BASE = Runtime.GLOBAL_BASE;
  STATICTOP = STATIC_BASE + 27888;
  __ATINIT__.push();
  allocate(
    [
      52,
      24,
      0,
      0,
      183,
      24,
      0,
      0,
      92,
      24,
      0,
      0,
      144,
      24,
      0,
      0,
      8,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      212,
      24,
      0,
      0,
      8,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      253,
      24,
      0,
      0,
      64,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      25,
      25,
      0,
      0,
      92,
      24,
      0,
      0,
      233,
      26,
      0,
      0,
      48,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      11,
      27,
      0,
      0,
      92,
      24,
      0,
      0,
      48,
      27,
      0,
      0,
      48,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      112,
      40,
      0,
      0,
      88,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      96,
      27,
      0,
      0,
      144,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      185,
      27,
      0,
      0,
      160,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      13,
      28,
      0,
      0,
      176,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      65,
      28,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      108,
      28,
      0,
      0,
      92,
      24,
      0,
      0,
      144,
      28,
      0,
      0,
      216,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      46,
      29,
      0,
      0,
      92,
      24,
      0,
      0,
      119,
      30,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      15,
      31,
      0,
      0,
      144,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      152,
      31,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      50,
      32,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      196,
      32,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      106,
      33,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      5,
      34,
      0,
      0,
      240,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      155,
      34,
      0,
      0,
      96,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      70,
      35,
      0,
      0,
      92,
      24,
      0,
      0,
      241,
      35,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      150,
      36,
      0,
      0,
      144,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      44,
      37,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      211,
      37,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      114,
      38,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      37,
      39,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      205,
      39,
      0,
      0,
      120,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      240,
      77,
      0,
      0,
      112,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      21,
      45,
      0,
      0,
      248,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      134,
      45,
      0,
      0,
      160,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      179,
      47,
      0,
      0,
      24,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      105,
      48,
      0,
      0,
      92,
      24,
      0,
      0,
      208,
      50,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      128,
      51,
      0,
      0,
      248,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      193,
      52,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      10,
      54,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      180,
      54,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      114,
      55,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      37,
      56,
      0,
      0,
      48,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      211,
      56,
      0,
      0,
      160,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      150,
      57,
      0,
      0,
      92,
      24,
      0,
      0,
      89,
      58,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      22,
      59,
      0,
      0,
      248,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      196,
      59,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      131,
      60,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      58,
      61,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      5,
      62,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      197,
      62,
      0,
      0,
      184,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      128,
      63,
      0,
      0,
      40,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      204,
      63,
      0,
      0,
      56,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      20,
      64,
      0,
      0,
      92,
      24,
      0,
      0,
      243,
      64,
      0,
      0,
      80,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      87,
      65,
      0,
      0,
      160,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      182,
      65,
      0,
      0,
      112,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      95,
      66,
      0,
      0,
      92,
      24,
      0,
      0,
      8,
      67,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      171,
      67,
      0,
      0,
      80,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      63,
      68,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      228,
      68,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      129,
      69,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      50,
      70,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      216,
      70,
      0,
      0,
      136,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      121,
      71,
      0,
      0,
      248,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      47,
      72,
      0,
      0,
      92,
      24,
      0,
      0,
      229,
      72,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      149,
      73,
      0,
      0,
      80,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      54,
      74,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      232,
      74,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      146,
      75,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      80,
      76,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      3,
      77,
      0,
      0,
      16,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      177,
      77,
      0,
      0,
      56,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      27,
      78,
      0,
      0,
      112,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      179,
      78,
      0,
      0,
      80,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      201,
      78,
      0,
      0,
      144,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      183,
      81,
      0,
      0,
      8,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      234,
      78,
      0,
      0,
      92,
      24,
      0,
      0,
      50,
      79,
      0,
      0,
      216,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      252,
      79,
      0,
      0,
      52,
      24,
      0,
      0,
      22,
      80,
      0,
      0,
      92,
      24,
      0,
      0,
      81,
      80,
      0,
      0,
      216,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      250,
      80,
      0,
      0,
      216,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      3,
      82,
      0,
      0,
      92,
      24,
      0,
      0,
      49,
      82,
      0,
      0,
      8,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      135,
      82,
      0,
      0,
      8,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      244,
      82,
      0,
      0,
      144,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      218,
      82,
      0,
      0,
      216,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      20,
      83,
      0,
      0,
      92,
      24,
      0,
      0,
      71,
      84,
      0,
      0,
      80,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      105,
      84,
      0,
      0,
      80,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      117,
      85,
      0,
      0,
      136,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      122,
      86,
      0,
      0,
      52,
      24,
      0,
      0,
      247,
      100,
      0,
      0,
      92,
      24,
      0,
      0,
      87,
      101,
      0,
      0,
      168,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      4,
      101,
      0,
      0,
      184,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      52,
      24,
      0,
      0,
      37,
      101,
      0,
      0,
      92,
      24,
      0,
      0,
      50,
      101,
      0,
      0,
      152,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      72,
      102,
      0,
      0,
      144,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      121,
      102,
      0,
      0,
      168,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      92,
      24,
      0,
      0,
      85,
      102,
      0,
      0,
      224,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      32,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      96,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      112,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      144,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      128,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      64,
      1,
      0,
      0,
      14,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      48,
      1,
      0,
      0,
      14,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      32,
      1,
      0,
      0,
      19,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      23,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      1,
      0,
      0,
      21,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      25,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      26,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      23,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      23,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      25,
      0,
      0,
      0,
      27,
      0,
      0,
      0,
      28,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      224,
      0,
      0,
      0,
      25,
      0,
      0,
      0,
      26,
      0,
      0,
      0,
      26,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      27,
      0,
      0,
      0,
      28,
      0,
      0,
      0,
      30,
      0,
      0,
      0,
      31,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      32,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      200,
      0,
      0,
      0,
      27,
      0,
      0,
      0,
      28,
      0,
      0,
      0,
      33,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      200,
      1,
      0,
      0,
      14,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      30,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      31,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      184,
      1,
      0,
      0,
      14,
      0,
      0,
      0,
      30,
      0,
      0,
      0,
      32,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      33,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      168,
      1,
      0,
      0,
      31,
      0,
      0,
      0,
      32,
      0,
      0,
      0,
      34,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      35,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      34,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      152,
      1,
      0,
      0,
      33,
      0,
      0,
      0,
      34,
      0,
      0,
      0,
      36,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      37,
      0,
      0,
      0,
      38,
      0,
      0,
      0,
      35,
      0,
      0,
      0,
      36,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      37,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      136,
      1,
      0,
      0,
      35,
      0,
      0,
      0,
      36,
      0,
      0,
      0,
      39,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      40,
      0,
      0,
      0,
      41,
      0,
      0,
      0,
      38,
      0,
      0,
      0,
      39,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      40,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      104,
      1,
      0,
      0,
      37,
      0,
      0,
      0,
      38,
      0,
      0,
      0,
      42,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      43,
      0,
      0,
      0,
      44,
      0,
      0,
      0,
      41,
      0,
      0,
      0,
      42,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      43,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      80,
      1,
      0,
      0,
      39,
      0,
      0,
      0,
      40,
      0,
      0,
      0,
      44,
      0,
      0,
      0,
      45,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      216,
      1,
      0,
      0,
      12,
      0,
      0,
      0,
      41,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      45,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      112,
      4,
      0,
      0,
      42,
      0,
      0,
      0,
      43,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      24,
      3,
      0,
      0,
      42,
      0,
      0,
      0,
      44,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      232,
      1,
      0,
      0,
      45,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      49,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      51,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      128,
      2,
      0,
      0,
      45,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      55,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      56,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      112,
      2,
      0,
      0,
      45,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      57,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      58,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      96,
      2,
      0,
      0,
      49,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      59,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      60,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      49,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      80,
      2,
      0,
      0,
      51,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      61,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      62,
      0,
      0,
      0,
      63,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      51,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      64,
      2,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      64,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      65,
      0,
      0,
      0,
      66,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      55,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      32,
      2,
      0,
      0,
      55,
      0,
      0,
      0,
      56,
      0,
      0,
      0,
      67,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      68,
      0,
      0,
      0,
      69,
      0,
      0,
      0,
      56,
      0,
      0,
      0,
      57,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      58,
      0,
      0,
      0,
      20,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      8,
      2,
      0,
      0,
      57,
      0,
      0,
      0,
      58,
      0,
      0,
      0,
      59,
      0,
      0,
      0,
      70,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      8,
      3,
      0,
      0,
      45,
      0,
      0,
      0,
      59,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      21,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      248,
      2,
      0,
      0,
      45,
      0,
      0,
      0,
      60,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      74,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      48,
      0,
      0,
      0,
      22,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      232,
      2,
      0,
      0,
      61,
      0,
      0,
      0,
      62,
      0,
      0,
      0,
      75,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      76,
      0,
      0,
      0,
      52,
      0,
      0,
      0,
      46,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      60,
      0,
      0,
      0,
      23,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      216,
      2,
      0,
      0,
      63,
      0,
      0,
      0,
      64,
      0,
      0,
      0,
      77,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      78,
      0,
      0,
      0,
      79,
      0,
      0,
      0,
      61,
      0,
      0,
      0,
      62,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      63,
      0,
      0,
      0,
      24,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      200,
      2,
      0,
      0,
      65,
      0,
      0,
      0,
      66,
      0,
      0,
      0,
      80,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      81,
      0,
      0,
      0,
      82,
      0,
      0,
      0,
      64,
      0,
      0,
      0,
      65,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      66,
      0,
      0,
      0,
      25,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      168,
      2,
      0,
      0,
      67,
      0,
      0,
      0,
      68,
      0,
      0,
      0,
      83,
      0,
      0,
      0,
      50,
      0,
      0,
      0,
      84,
      0,
      0,
      0,
      85,
      0,
      0,
      0,
      67,
      0,
      0,
      0,
      68,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      54,
      0,
      0,
      0,
      69,
      0,
      0,
      0,
      26,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      144,
      2,
      0,
      0,
      69,
      0,
      0,
      0,
      70,
      0,
      0,
      0,
      70,
      0,
      0,
      0,
      86,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      64,
      3,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      87,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      89,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      27,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      216,
      3,
      0,
      0,
      71,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      93,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      94,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      28,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      200,
      3,
      0,
      0,
      71,
      0,
      0,
      0,
      74,
      0,
      0,
      0,
      95,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      96,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      184,
      3,
      0,
      0,
      75,
      0,
      0,
      0,
      76,
      0,
      0,
      0,
      97,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      98,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      74,
      0,
      0,
      0,
      30,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      168,
      3,
      0,
      0,
      77,
      0,
      0,
      0,
      78,
      0,
      0,
      0,
      99,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      100,
      0,
      0,
      0,
      101,
      0,
      0,
      0,
      75,
      0,
      0,
      0,
      76,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      77,
      0,
      0,
      0,
      31,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      152,
      3,
      0,
      0,
      79,
      0,
      0,
      0,
      80,
      0,
      0,
      0,
      102,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      103,
      0,
      0,
      0,
      104,
      0,
      0,
      0,
      78,
      0,
      0,
      0,
      79,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      80,
      0,
      0,
      0,
      32,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      120,
      3,
      0,
      0,
      81,
      0,
      0,
      0,
      82,
      0,
      0,
      0,
      105,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      106,
      0,
      0,
      0,
      107,
      0,
      0,
      0,
      81,
      0,
      0,
      0,
      82,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      83,
      0,
      0,
      0,
      33,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      96,
      3,
      0,
      0,
      83,
      0,
      0,
      0,
      84,
      0,
      0,
      0,
      84,
      0,
      0,
      0,
      108,
      0,
      0,
      0,
      6,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      96,
      4,
      0,
      0,
      71,
      0,
      0,
      0,
      85,
      0,
      0,
      0,
      109,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      110,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      34,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      80,
      4,
      0,
      0,
      71,
      0,
      0,
      0,
      86,
      0,
      0,
      0,
      111,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      112,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      35,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      64,
      4,
      0,
      0,
      87,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      113,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      114,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      72,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      85,
      0,
      0,
      0,
      36,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      48,
      4,
      0,
      0,
      89,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      115,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      116,
      0,
      0,
      0,
      117,
      0,
      0,
      0,
      86,
      0,
      0,
      0,
      87,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      37,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      32,
      4,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      118,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      119,
      0,
      0,
      0,
      120,
      0,
      0,
      0,
      89,
      0,
      0,
      0,
      90,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      38,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      4,
      0,
      0,
      93,
      0,
      0,
      0,
      94,
      0,
      0,
      0,
      121,
      0,
      0,
      0,
      88,
      0,
      0,
      0,
      122,
      0,
      0,
      0,
      123,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      93,
      0,
      0,
      0,
      91,
      0,
      0,
      0,
      92,
      0,
      0,
      0,
      94,
      0,
      0,
      0,
      39,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      232,
      3,
      0,
      0,
      95,
      0,
      0,
      0,
      96,
      0,
      0,
      0,
      95,
      0,
      0,
      0,
      124,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      128,
      4,
      0,
      0,
      97,
      0,
      0,
      0,
      98,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      96,
      0,
      0,
      0,
      125,
      0,
      0,
      0,
      97,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      144,
      4,
      0,
      0,
      99,
      0,
      0,
      0,
      100,
      0,
      0,
      0,
      126,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      128,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      132,
      0,
      0,
      0,
      98,
      0,
      0,
      0,
      99,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      160,
      4,
      0,
      0,
      101,
      0,
      0,
      0,
      102,
      0,
      0,
      0,
      126,
      0,
      0,
      0,
      133,
      0,
      0,
      0,
      100,
      0,
      0,
      0,
      128,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      134,
      0,
      0,
      0,
      135,
      0,
      0,
      0,
      101,
      0,
      0,
      0,
      102,
      0,
      0,
      0,
      136,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      176,
      4,
      0,
      0,
      103,
      0,
      0,
      0,
      104,
      0,
      0,
      0,
      103,
      0,
      0,
      0,
      104,
      0,
      0,
      0,
      105,
      0,
      0,
      0,
      106,
      0,
      0,
      0,
      137,
      0,
      0,
      0,
      138,
      0,
      0,
      0,
      139,
      0,
      0,
      0,
      140,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      200,
      4,
      0,
      0,
      105,
      0,
      0,
      0,
      106,
      0,
      0,
      0,
      107,
      0,
      0,
      0,
      141,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      4,
      0,
      0,
      107,
      0,
      0,
      0,
      108,
      0,
      0,
      0,
      109,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      232,
      4,
      0,
      0,
      110,
      0,
      0,
      0,
      111,
      0,
      0,
      0,
      108,
      0,
      0,
      0,
      142,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      224,
      4,
      0,
      0,
      112,
      0,
      0,
      0,
      113,
      0,
      0,
      0,
      114,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      248,
      4,
      0,
      0,
      115,
      0,
      0,
      0,
      116,
      0,
      0,
      0,
      109,
      0,
      0,
      0,
      143,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      5,
      0,
      0,
      117,
      0,
      0,
      0,
      118,
      0,
      0,
      0,
      110,
      0,
      0,
      0,
      111,
      0,
      0,
      0,
      112,
      0,
      0,
      0,
      113,
      0,
      0,
      0,
      144,
      0,
      0,
      0,
      145,
      0,
      0,
      0,
      146,
      0,
      0,
      0,
      147,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      32,
      5,
      0,
      0,
      119,
      0,
      0,
      0,
      120,
      0,
      0,
      0,
      114,
      0,
      0,
      0,
      115,
      0,
      0,
      0,
      116,
      0,
      0,
      0,
      117,
      0,
      0,
      0,
      148,
      0,
      0,
      0,
      149,
      0,
      0,
      0,
      150,
      0,
      0,
      0,
      151,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      48,
      5,
      0,
      0,
      99,
      0,
      0,
      0,
      121,
      0,
      0,
      0,
      126,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      118,
      0,
      0,
      0,
      128,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      132,
      0,
      0,
      0,
      98,
      0,
      0,
      0,
      99,
      0,
      0,
      0,
      152,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      64,
      5,
      0,
      0,
      122,
      0,
      0,
      0,
      123,
      0,
      0,
      0,
      119,
      0,
      0,
      0,
      153,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      80,
      5,
      0,
      0,
      99,
      0,
      0,
      0,
      124,
      0,
      0,
      0,
      154,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      155,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      88,
      5,
      0,
      0,
      99,
      0,
      0,
      0,
      125,
      0,
      0,
      0,
      154,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      120,
      0,
      0,
      0,
      156,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      104,
      5,
      0,
      0,
      99,
      0,
      0,
      0,
      126,
      0,
      0,
      0,
      154,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      121,
      0,
      0,
      0,
      157,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      120,
      5,
      0,
      0,
      127,
      0,
      0,
      0,
      128,
      0,
      0,
      0,
      8,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      158,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      0,
      136,
      5,
      0,
      0,
      130,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      158,
      0,
      0,
      0,
      129,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      192,
      0,
      0,
      0,
      192,
      56,
      20,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      159,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      228,
      104,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      184,
      104,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      172,
      21,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      159,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      236,
      104,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      10,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      255,
      255,
      255,
      255,
      255,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      7,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      23,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      31,
      0,
      0,
      0,
      37,
      0,
      0,
      0,
      41,
      0,
      0,
      0,
      43,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      59,
      0,
      0,
      0,
      61,
      0,
      0,
      0,
      67,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      79,
      0,
      0,
      0,
      83,
      0,
      0,
      0,
      89,
      0,
      0,
      0,
      97,
      0,
      0,
      0,
      101,
      0,
      0,
      0,
      103,
      0,
      0,
      0,
      107,
      0,
      0,
      0,
      109,
      0,
      0,
      0,
      113,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      137,
      0,
      0,
      0,
      139,
      0,
      0,
      0,
      149,
      0,
      0,
      0,
      151,
      0,
      0,
      0,
      157,
      0,
      0,
      0,
      163,
      0,
      0,
      0,
      167,
      0,
      0,
      0,
      173,
      0,
      0,
      0,
      179,
      0,
      0,
      0,
      181,
      0,
      0,
      0,
      191,
      0,
      0,
      0,
      193,
      0,
      0,
      0,
      197,
      0,
      0,
      0,
      199,
      0,
      0,
      0,
      211,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      17,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      23,
      0,
      0,
      0,
      29,
      0,
      0,
      0,
      31,
      0,
      0,
      0,
      37,
      0,
      0,
      0,
      41,
      0,
      0,
      0,
      43,
      0,
      0,
      0,
      47,
      0,
      0,
      0,
      53,
      0,
      0,
      0,
      59,
      0,
      0,
      0,
      61,
      0,
      0,
      0,
      67,
      0,
      0,
      0,
      71,
      0,
      0,
      0,
      73,
      0,
      0,
      0,
      79,
      0,
      0,
      0,
      83,
      0,
      0,
      0,
      89,
      0,
      0,
      0,
      97,
      0,
      0,
      0,
      101,
      0,
      0,
      0,
      103,
      0,
      0,
      0,
      107,
      0,
      0,
      0,
      109,
      0,
      0,
      0,
      113,
      0,
      0,
      0,
      121,
      0,
      0,
      0,
      127,
      0,
      0,
      0,
      131,
      0,
      0,
      0,
      137,
      0,
      0,
      0,
      139,
      0,
      0,
      0,
      143,
      0,
      0,
      0,
      149,
      0,
      0,
      0,
      151,
      0,
      0,
      0,
      157,
      0,
      0,
      0,
      163,
      0,
      0,
      0,
      167,
      0,
      0,
      0,
      169,
      0,
      0,
      0,
      173,
      0,
      0,
      0,
      179,
      0,
      0,
      0,
      181,
      0,
      0,
      0,
      187,
      0,
      0,
      0,
      191,
      0,
      0,
      0,
      193,
      0,
      0,
      0,
      197,
      0,
      0,
      0,
      199,
      0,
      0,
      0,
      209,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      238,
      100,
      0,
      0,
      0,
      0,
      0,
      0,
      152,
      5,
      0,
      0,
      132,
      0,
      0,
      0,
      133,
      0,
      0,
      0,
      134,
      0,
      0,
      0,
      135,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      3,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      192,
      5,
      0,
      0,
      132,
      0,
      0,
      0,
      136,
      0,
      0,
      0,
      134,
      0,
      0,
      0,
      135,
      0,
      0,
      0,
      19,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      2,
      0,
      0,
      0,
      4,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      208,
      5,
      0,
      0,
      137,
      0,
      0,
      0,
      138,
      0,
      0,
      0,
      160,
      0,
      0,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      56,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      56,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      48,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      81,
      117,
      97,
      110,
      116,
      105,
      122,
      97,
      116,
      105,
      111,
      110,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      55,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      54,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      110,
      116,
      101,
      114,
      102,
      97,
      99,
      101,
      69,
      0,
      75,
      100,
      84,
      114,
      101,
      101,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      58,
      32,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      32,
      108,
      101,
      118,
      101,
      108,
      32,
      37,
      105,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      46,
      10,
      0,
      40,
      118,
      97,
      108,
      46,
      115,
      105,
      122,
      101,
      40,
      41,
      41,
      32,
      61,
      61,
      32,
      40,
      100,
      105,
      109,
      101,
      110,
      115,
      105,
      111,
      110,
      95,
      116,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      107,
      100,
      95,
      116,
      114,
      101,
      101,
      95,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      99,
      99,
      0,
      111,
      112,
      101,
      114,
      97,
      116,
      111,
      114,
      61,
      0,
      77,
      101,
      116,
      104,
      111,
      100,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      46,
      32,
      10,
      0,
      86,
      101,
      114,
      115,
      105,
      111,
      110,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      46,
      32,
      10,
      0,
      40,
      105,
      110,
      102,
      111,
      46,
      114,
      97,
      110,
      103,
      101,
      41,
      32,
      62,
      61,
      32,
      40,
      48,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      47,
      97,
      108,
      103,
      111,
      114,
      105,
      116,
      104,
      109,
      115,
      47,
      113,
      117,
      97,
      110,
      116,
      105,
      122,
      101,
      95,
      112,
      111,
      105,
      110,
      116,
      115,
      95,
      51,
      46,
      104,
      0,
      68,
      101,
      113,
      117,
      97,
      110,
      116,
      105,
      122,
      101,
      80,
      111,
      105,
      110,
      116,
      115,
      51,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      51,
      75,
      100,
      84,
      114,
      101,
      101,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      54,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      55,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      115,
      67,
      111,
      110,
      116,
      114,
      111,
      108,
      108,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      56,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      108,
      116,
      97,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      51,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      121,
      112,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      110,
      116,
      101,
      114,
      102,
      97,
      99,
      101,
      73,
      105,
      105,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      110,
      116,
      101,
      114,
      102,
      97,
      99,
      101,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      53,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      73,
      110,
      116,
      101,
      114,
      102,
      97,
      99,
      101,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      102,
      97,
      108,
      115,
      101,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      119,
      114,
      97,
      112,
      95,
      116,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      95,
      98,
      97,
      115,
      101,
      46,
      104,
      0,
      113,
      117,
      97,
      110,
      116,
      105,
      122,
      97,
      116,
      105,
      111,
      110,
      95,
      98,
      105,
      116,
      115,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      51,
      55,
      80,
      114,
      101,
    ],
    'i8',
    ALLOC_NONE,
    Runtime.GLOBAL_BASE
  );
  allocate(
    [
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      87,
      114,
      97,
      112,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      51,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      73,
      110,
      116,
      101,
      103,
      101,
      114,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      40,
      113,
      41,
      32,
      62,
      61,
      32,
      40,
      50,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      95,
      117,
      116,
      105,
      108,
      115,
      46,
      104,
      0,
      83,
      101,
      116,
      81,
      117,
      97,
      110,
      116,
      105,
      122,
      97,
      116,
      105,
      111,
      110,
      66,
      105,
      116,
      115,
      0,
      40,
      113,
      41,
      32,
      60,
      61,
      32,
      40,
      51,
      48,
      41,
      0,
      40,
      105,
      110,
      95,
      115,
      41,
      32,
      62,
      61,
      32,
      40,
      48,
      41,
      0,
      79,
      99,
      116,
      97,
      104,
      101,
      114,
      100,
      97,
      108,
      67,
      111,
      111,
      114,
      100,
      115,
      84,
      111,
      85,
      110,
      105,
      116,
      86,
      101,
      99,
      116,
      111,
      114,
      0,
      40,
      105,
      110,
      95,
      116,
      41,
      32,
      62,
      61,
      32,
      40,
      48,
      41,
      0,
      40,
      105,
      110,
      95,
      115,
      41,
      32,
      60,
      61,
      32,
      40,
      49,
      41,
      0,
      40,
      105,
      110,
      95,
      116,
      41,
      32,
      60,
      61,
      32,
      40,
      49,
      41,
      0,
      40,
      112,
      114,
      101,
      100,
      95,
      118,
      97,
      108,
      115,
      91,
      48,
      93,
      41,
      32,
      60,
      61,
      32,
      40,
      50,
      32,
      42,
      32,
      116,
      104,
      105,
      115,
      45,
      62,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      111,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      95,
      99,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      95,
      100,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      95,
      116,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      46,
      104,
      0,
      67,
      111,
      109,
      112,
      117,
      116,
      101,
      79,
      114,
      105,
      103,
      105,
      110,
      97,
      108,
      86,
      97,
      108,
      117,
      101,
      0,
      40,
      112,
      114,
      101,
      100,
      95,
      118,
      97,
      108,
      115,
      91,
      49,
      93,
      41,
      32,
      60,
      61,
      32,
      40,
      50,
      32,
      42,
      32,
      116,
      104,
      105,
      115,
      45,
      62,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      40,
      99,
      111,
      114,
      114,
      95,
      118,
      97,
      108,
      115,
      91,
      48,
      93,
      41,
      32,
      60,
      61,
      32,
      40,
      50,
      32,
      42,
      32,
      116,
      104,
      105,
      115,
      45,
      62,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      40,
      99,
      111,
      114,
      114,
      95,
      118,
      97,
      108,
      115,
      91,
      49,
      93,
      41,
      32,
      60,
      61,
      32,
      40,
      50,
      32,
      42,
      32,
      116,
      104,
      105,
      115,
      45,
      62,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      112,
      114,
      101,
      100,
      95,
      118,
      97,
      108,
      115,
      91,
      48,
      93,
      41,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      112,
      114,
      101,
      100,
      95,
      118,
      97,
      108,
      115,
      91,
      49,
      93,
      41,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      111,
      114,
      114,
      95,
      118,
      97,
      108,
      115,
      91,
      48,
      93,
      41,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      111,
      114,
      114,
      95,
      118,
      97,
      108,
      115,
      91,
      49,
      93,
      41,
      0,
      40,
      115,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      73,
      115,
      73,
      110,
      68,
      105,
      97,
      109,
      111,
      110,
      100,
      0,
      40,
      116,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      115,
      41,
      32,
      62,
      61,
      32,
      40,
      45,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      116,
      41,
      32,
      62,
      61,
      32,
      40,
      45,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      42,
      115,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      73,
      110,
      118,
      101,
      114,
      116,
      68,
      105,
      97,
      109,
      111,
      110,
      100,
      0,
      40,
      42,
      116,
      41,
      32,
      60,
      61,
      32,
      40,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      42,
      115,
      41,
      32,
      62,
      61,
      32,
      40,
      45,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      42,
      116,
      41,
      32,
      62,
      61,
      32,
      40,
      45,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      40,
      109,
      97,
      120,
      95,
      113,
      117,
      97,
      110,
      116,
      105,
      122,
      101,
      100,
      95,
      118,
      97,
      108,
      117,
      101,
      32,
      37,
      32,
      50,
      41,
      32,
      61,
      61,
      32,
      40,
      49,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      111,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      95,
      116,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      95,
      98,
      97,
      115,
      101,
      46,
      104,
      0,
      115,
      101,
      116,
      95,
      109,
      97,
      120,
      95,
      113,
      117,
      97,
      110,
      116,
      105,
      122,
      101,
      100,
      95,
      118,
      97,
      108,
      117,
      101,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      56,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      108,
      116,
      97,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      51,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      69,
      69,
      0,
      116,
      104,
      105,
      115,
      45,
      62,
      73,
      115,
      73,
      110,
      105,
      116,
      105,
      97,
      108,
      105,
      122,
      101,
      100,
      40,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      109,
      101,
      115,
      104,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      103,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      95,
      97,
      114,
      101,
      97,
      46,
      104,
      0,
      67,
      111,
      109,
      112,
      117,
      116,
      101,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      101,
      100,
      86,
      97,
      108,
      117,
      101,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      109,
      101,
      115,
      104,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      103,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      95,
      98,
      97,
      115,
      101,
      46,
      104,
      0,
      71,
      101,
      116,
      80,
      111,
      115,
      105,
      116,
      105,
      111,
      110,
      70,
      111,
      114,
      67,
      111,
      114,
      110,
      101,
      114,
      0,
      40,
      110,
      111,
      114,
      109,
      97,
      108,
      46,
      65,
      98,
      115,
      83,
      117,
      109,
      40,
      41,
      41,
      32,
      60,
      61,
      32,
      40,
      117,
      112,
      112,
      101,
      114,
      95,
      98,
      111,
      117,
      110,
      100,
      41,
      0,
      71,
      101,
      116,
      80,
      111,
      115,
      105,
      116,
      105,
      111,
      110,
      70,
      111,
      114,
      68,
      97,
      116,
      97,
      73,
      100,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      109,
      101,
      115,
      104,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      103,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      104,
      0,
      67,
      111,
      109,
      112,
      117,
      116,
      101,
      79,
      114,
      105,
      103,
      105,
      110,
      97,
      108,
      86,
      97,
      108,
      117,
      101,
      115,
      0,
      40,
      110,
      117,
      109,
      95,
      99,
      111,
      109,
      112,
      111,
      110,
      101,
      110,
      116,
      115,
      41,
      32,
      61,
      61,
      32,
      40,
      50,
      41,
      0,
      40,
      112,
      114,
      101,
      100,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      51,
      100,
      46,
      65,
      98,
      115,
      83,
      117,
      109,
      40,
      41,
      41,
      32,
      61,
      61,
      32,
      40,
      111,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      95,
      116,
      111,
      111,
      108,
      95,
      98,
      111,
      120,
      95,
      46,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      40,
      115,
      116,
      100,
      58,
      58,
      97,
      98,
      115,
      40,
      105,
      110,
      116,
      95,
      118,
      101,
      99,
      91,
      48,
      93,
      41,
      32,
      43,
      32,
      115,
      116,
      100,
      58,
      58,
      97,
      98,
      115,
      40,
      105,
      110,
      116,
      95,
      118,
      101,
      99,
      91,
      49,
      93,
      41,
      32,
      43,
      32,
      115,
      116,
      100,
      58,
      58,
      97,
      98,
      115,
      40,
      105,
      110,
      116,
      95,
      118,
      101,
      99,
      91,
      50,
      93,
      41,
      41,
      32,
      61,
      61,
      32,
      40,
      99,
      101,
      110,
      116,
      101,
      114,
      95,
      118,
      97,
      108,
      117,
      101,
      95,
      41,
      0,
      73,
      110,
      116,
      101,
      103,
      101,
      114,
      86,
      101,
      99,
      116,
      111,
      114,
      84,
      111,
      81,
      117,
      97,
      110,
      116,
      105,
      122,
      101,
      100,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      97,
      108,
      67,
      111,
      111,
      114,
      100,
      115,
      0,
      40,
      105,
      41,
      32,
      61,
      61,
      32,
      40,
      48,
      41,
      0,
      71,
      101,
      116,
      80,
      97,
      114,
      101,
      110,
      116,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      84,
      121,
      112,
      101,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      109,
      101,
      115,
      104,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      116,
      101,
      120,
      95,
      99,
      111,
      111,
      114,
      100,
      115,
      95,
      112,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      104,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      109,
      101,
      115,
      104,
      95,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      116,
      101,
      120,
      95,
      99,
      111,
      111,
      114,
      100,
      115,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      104,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      54,
      50,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      56,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      67,
      97,
      110,
      111,
      110,
      105,
      99,
      97,
      108,
      105,
      122,
      101,
      100,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      66,
      97,
      115,
      101,
      73,
      105,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      66,
      97,
      115,
      101,
      73,
      105,
      69,
      69,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      115,
      47,
      112,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      95,
      115,
      99,
      104,
      101,
      109,
      101,
      95,
      110,
      111,
      114,
      109,
      97,
      108,
      95,
      111,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      95,
      100,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      95,
      116,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      46,
      104,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      56,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      108,
      116,
      97,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      51,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      65,
      114,
      101,
      97,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      56,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      111,
      114,
      66,
      97,
      115,
      101,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      50,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      71,
      101,
      111,
      109,
      101,
      116,
      114,
      105,
      99,
      78,
      111,
      114,
      109,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      80,
      111,
      114,
      116,
      97,
      98,
      108,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      84,
      101,
      120,
      67,
      111,
      111,
      114,
      100,
      115,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      53,
      54,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      67,
      111,
      110,
      115,
      116,
      114,
      97,
      105,
      110,
      101,
      100,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      53,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      77,
      117,
      108,
      116,
      105,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      48,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      80,
      97,
      114,
      97,
      108,
      108,
      101,
      108,
      111,
      103,
      114,
      97,
      109,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      105,
      78,
      83,
      95,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      68,
      97,
      116,
      97,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      57,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      83,
      99,
      104,
      101,
      109,
      101,
      78,
      111,
      114,
      109,
      97,
      108,
      79,
      99,
      116,
      97,
      104,
      101,
      100,
      114,
      111,
      110,
      68,
      101,
      99,
      111,
      100,
      105,
      110,
      103,
      84,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      73,
      105,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      50,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      78,
      111,
      114,
      109,
      97,
      108,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      56,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      81,
      117,
      97,
      110,
      116,
      105,
      122,
      97,
      116,
      105,
      111,
      110,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      85,
      110,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      32,
      101,
      110,
      99,
      111,
      100,
      105,
      110,
      103,
      32,
      109,
      101,
      116,
      104,
      111,
      100,
      46,
      0,
      73,
      110,
      112,
      117,
      116,
      32,
      105,
      115,
      32,
      110,
      111,
      116,
      32,
      97,
      32,
      109,
      101,
      115,
      104,
      46,
      0,
      73,
      110,
      112,
      117,
      116,
      32,
      105,
      115,
      32,
      110,
      111,
      116,
      32,
      97,
      32,
      112,
      111,
      105,
      110,
      116,
      32,
      99,
      108,
      111,
      117,
      100,
      46,
      0,
      115,
      107,
      105,
      112,
      95,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      95,
      116,
      114,
      97,
      110,
      115,
      102,
      111,
      114,
      109,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      49,
      77,
      101,
      115,
      104,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      50,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      57,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      111,
      99,
      101,
      115,
      115,
      111,
      114,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      50,
      77,
      101,
      115,
      104,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      83,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      48,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      57,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      111,
      99,
      101,
      115,
      115,
      111,
      114,
      73,
      78,
      83,
      95,
      50,
      52,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      78,
      83,
      95,
      51,
      54,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      73,
      110,
      100,
      105,
      99,
      101,
      115,
      69,
      110,
      99,
      111,
      100,
      105,
      110,
      103,
      79,
      98,
      115,
      101,
      114,
      118,
      101,
      114,
      73,
      83,
      51,
      95,
      69,
      69,
      78,
      83,
      95,
      49,
      57,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      79,
      98,
      115,
      101,
      114,
      118,
      101,
      114,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      53,
      80,
      111,
      105,
    ],
    'i8',
    ALLOC_NONE,
    Runtime.GLOBAL_BASE + 10240
  );
  allocate(
    [
      110,
      116,
      115,
      83,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      57,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      111,
      99,
      101,
      115,
      115,
      111,
      114,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      50,
      77,
      101,
      115,
      104,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      83,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      53,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      111,
      110,
      68,
      101,
      103,
      114,
      101,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      57,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      111,
      99,
      101,
      115,
      115,
      111,
      114,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      78,
      83,
      95,
      51,
      54,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      73,
      110,
      100,
      105,
      99,
      101,
      115,
      69,
      110,
      99,
      111,
      100,
      105,
      110,
      103,
      79,
      98,
      115,
      101,
      114,
      118,
      101,
      114,
      73,
      83,
      51,
      95,
      69,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      50,
      77,
      101,
      115,
      104,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      83,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      48,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      101,
      114,
      73,
      78,
      83,
      95,
      50,
      57,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      111,
      99,
      101,
      115,
      115,
      111,
      114,
      73,
      78,
      83,
      95,
      49,
      49,
      67,
      111,
      114,
      110,
      101,
      114,
      84,
      97,
      98,
      108,
      101,
      69,
      69,
      69,
      78,
      83,
      95,
      51,
      54,
      77,
      101,
      115,
      104,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      73,
      110,
      100,
      105,
      99,
      101,
      115,
      69,
      110,
      99,
      111,
      100,
      105,
      110,
      103,
      79,
      98,
      115,
      101,
      114,
      118,
      101,
      114,
      73,
      83,
      51,
      95,
      69,
      69,
      78,
      83,
      95,
      49,
      57,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      79,
      98,
      115,
      101,
      114,
      118,
      101,
      114,
      69,
      69,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      54,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      109,
      112,
      108,
      73,
      78,
      83,
      95,
      51,
      49,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      51,
      53,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      109,
      112,
      108,
      73,
      110,
      116,
      101,
      114,
      102,
      97,
      99,
      101,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      54,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      109,
      112,
      108,
      73,
      78,
      83,
      95,
      52,
      49,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      80,
      114,
      101,
      100,
      105,
      99,
      116,
      105,
      118,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      54,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      73,
      109,
      112,
      108,
      73,
      78,
      83,
      95,
      51,
      56,
      77,
      101,
      115,
      104,
      69,
      100,
      103,
      101,
      66,
      114,
      101,
      97,
      107,
      101,
      114,
      84,
      114,
      97,
      118,
      101,
      114,
      115,
      97,
      108,
      86,
      97,
      108,
      101,
      110,
      99,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      69,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      53,
      76,
      105,
      110,
      101,
      97,
      114,
      83,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      49,
      77,
      101,
      115,
      104,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      55,
      80,
      111,
      105,
      110,
      116,
      67,
      108,
      111,
      117,
      100,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      70,
      97,
      105,
      108,
      101,
      100,
      32,
      116,
      111,
      32,
      112,
      97,
      114,
      115,
      101,
      32,
      68,
      114,
      97,
      99,
      111,
      32,
      104,
      101,
      97,
      100,
      101,
      114,
      46,
      0,
      68,
      82,
      65,
      67,
      79,
      0,
      78,
      111,
      116,
      32,
      97,
      32,
      68,
      114,
      97,
      99,
      111,
      32,
      102,
      105,
      108,
      101,
      46,
      0,
      70,
      97,
      105,
      108,
      101,
      100,
      32,
      116,
      111,
      32,
      100,
      101,
      99,
      111,
      100,
      101,
      32,
      109,
      101,
      116,
      97,
      100,
      97,
      116,
      97,
      46,
      0,
      85,
      115,
      105,
      110,
      103,
      32,
      105,
      110,
      99,
      111,
      109,
      112,
      97,
      116,
      105,
      98,
      108,
      101,
      32,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      32,
      102,
      111,
      114,
      32,
      116,
      104,
      101,
      32,
      105,
      110,
      112,
      117,
      116,
      32,
      103,
      101,
      111,
      109,
      101,
      116,
      114,
      121,
      46,
      0,
      85,
      110,
      107,
      110,
      111,
      119,
      110,
      32,
      109,
      97,
      106,
      111,
      114,
      32,
      118,
      101,
      114,
      115,
      105,
      111,
      110,
      46,
      0,
      85,
      110,
      107,
      110,
      111,
      119,
      110,
      32,
      109,
      105,
      110,
      111,
      114,
      32,
      118,
      101,
      114,
      115,
      105,
      111,
      110,
      46,
      0,
      70,
      97,
      105,
      108,
      101,
      100,
      32,
      116,
      111,
      32,
      105,
      110,
      105,
      116,
      105,
      97,
      108,
      105,
      122,
      101,
      32,
      116,
      104,
      101,
      32,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      0,
      70,
      97,
      105,
      108,
      101,
      100,
      32,
      116,
      111,
      32,
      100,
      101,
      99,
      111,
      100,
      101,
      32,
      103,
      101,
      111,
      109,
      101,
      116,
      114,
      121,
      32,
      100,
      97,
      116,
      97,
      46,
      0,
      70,
      97,
      105,
      108,
      101,
      100,
      32,
      116,
      111,
      32,
      100,
      101,
      99,
      111,
      100,
      101,
      32,
      112,
      111,
      105,
      110,
      116,
      32,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      46,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      51,
      80,
      111,
      105,
      110,
      116,
      67,
      108,
      111,
      117,
      100,
      75,
      100,
      84,
      114,
      101,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      50,
      55,
      80,
      111,
      105,
      110,
      116,
      67,
      108,
      111,
      117,
      100,
      83,
      101,
      113,
      117,
      101,
      110,
      116,
      105,
      97,
      108,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      69,
      0,
      37,
      100,
      0,
      40,
      110,
      98,
      105,
      116,
      115,
      41,
      32,
      62,
      61,
      32,
      40,
      48,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      114,
      101,
      47,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      95,
      98,
      117,
      102,
      102,
      101,
      114,
      46,
      104,
      0,
      71,
      101,
      116,
      66,
      105,
      116,
      115,
      0,
      40,
      110,
      98,
      105,
      116,
      115,
      41,
      32,
      60,
      61,
      32,
      40,
      51,
      50,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      114,
      101,
      47,
      98,
      105,
      116,
      95,
      99,
      111,
      100,
      101,
      114,
      115,
      47,
      114,
      97,
      110,
      115,
      95,
      98,
      105,
      116,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      99,
      99,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      52,
      77,
      101,
      115,
      104,
      69,
      0,
      33,
      105,
      100,
      101,
      110,
      116,
      105,
      116,
      121,
      95,
      109,
      97,
      112,
      112,
      105,
      110,
      103,
      95,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      46,
      104,
      0,
      83,
      101,
      116,
      80,
      111,
      105,
      110,
      116,
      77,
      97,
      112,
      69,
      110,
      116,
      114,
      121,
      0,
      97,
      116,
      116,
      95,
      105,
      100,
      32,
      62,
      61,
      32,
      48,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      46,
      99,
      99,
      0,
      83,
      101,
      116,
      65,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      0,
      78,
      53,
      100,
      114,
      97,
      99,
      111,
      49,
      48,
      80,
      111,
      105,
      110,
      116,
      67,
      108,
      111,
      117,
      100,
      69,
      0,
      70,
      108,
      111,
      97,
      116,
      80,
      111,
      105,
      110,
      116,
      115,
      84,
      114,
      101,
      101,
      68,
      101,
      99,
      111,
      100,
      101,
      114,
      58,
      32,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      32,
      108,
      101,
      118,
      101,
      108,
      32,
      37,
      105,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      46,
      10,
      0,
      40,
      116,
      114,
      117,
      101,
      41,
      32,
      61,
      61,
      32,
      40,
      110,
      117,
      109,
      95,
      114,
      101,
      109,
      97,
      105,
      110,
      105,
      110,
      103,
      95,
      112,
      111,
      105,
      110,
      116,
      115,
      32,
      33,
      61,
      32,
      48,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      109,
      112,
      114,
      101,
      115,
      115,
      105,
      111,
      110,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      47,
      97,
      108,
      103,
      111,
      114,
      105,
      116,
      104,
      109,
      115,
      47,
      100,
      121,
      110,
      97,
      109,
      105,
      99,
      95,
      105,
      110,
      116,
      101,
      103,
      101,
      114,
      95,
      112,
      111,
      105,
      110,
      116,
      115,
      95,
      107,
      100,
      95,
      116,
      114,
      101,
      101,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      104,
      0,
      68,
      101,
      99,
      111,
      100,
      101,
      73,
      110,
      116,
      101,
      114,
      110,
      97,
      108,
      0,
      40,
      116,
      114,
      117,
      101,
      41,
      32,
      61,
      61,
      32,
      40,
      110,
      98,
      105,
      116,
      115,
      32,
      60,
      61,
      32,
      51,
      50,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      99,
      111,
      114,
      101,
      47,
      98,
      105,
      116,
      95,
      99,
      111,
      100,
      101,
      114,
      115,
      47,
      100,
      105,
      114,
      101,
      99,
      116,
      95,
      98,
      105,
      116,
      95,
      100,
      101,
      99,
      111,
      100,
      101,
      114,
      46,
      104,
      0,
      68,
      101,
      99,
      111,
      100,
      101,
      76,
      101,
      97,
      115,
      116,
      83,
      105,
      103,
      110,
      105,
      102,
      105,
      99,
      97,
      110,
      116,
      66,
      105,
      116,
      115,
      51,
      50,
      0,
      40,
      116,
      114,
      117,
      101,
      41,
      32,
      61,
      61,
      32,
      40,
      110,
      98,
      105,
      116,
      115,
      32,
      62,
      32,
      48,
      41,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      97,
      116,
      116,
      95,
      105,
      100,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      47,
      112,
      111,
      105,
      110,
      116,
      95,
      99,
      108,
      111,
      117,
      100,
      46,
      104,
      0,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      0,
      40,
      97,
      116,
      116,
      95,
      105,
      100,
      41,
      32,
      60,
      32,
      40,
      115,
      116,
      97,
      116,
      105,
      99,
      95,
      99,
      97,
      115,
      116,
      60,
      105,
      110,
      116,
      51,
      50,
      95,
      116,
      62,
      40,
      97,
      116,
      116,
      114,
      105,
      98,
      117,
      116,
      101,
      115,
      95,
      46,
      115,
      105,
      122,
      101,
      40,
      41,
      41,
      41,
      0,
      110,
      97,
      109,
      101,
      0,
      40,
      48,
      41,
      32,
      60,
      61,
      32,
      40,
      102,
      97,
      99,
      101,
      95,
      105,
      100,
      46,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      0,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      115,
      114,
      99,
      47,
      99,
      108,
      111,
      117,
      100,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      102,
      105,
      120,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      51,
      47,
      116,
      104,
      105,
      114,
      100,
      95,
      112,
      97,
      114,
      116,
      121,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      115,
      114,
      99,
      47,
      100,
      114,
      97,
      99,
      111,
      47,
      109,
      101,
      115,
      104,
      47,
      109,
      101,
      115,
      104,
      46,
      104,
      0,
      102,
      97,
      99,
      101,
      0,
      40,
      102,
      97,
      99,
      101,
      95,
      105,
      100,
      46,
      118,
      97,
      108,
      117,
      101,
      40,
      41,
      41,
      32,
      60,
      32,
      40,
      115,
      116,
      97,
      116,
      105,
      99,
      95,
      99,
      97,
      115,
      116,
      60,
      105,
      110,
      116,
      62,
      40,
      102,
      97,
      99,
      101,
      115,
      95,
      46,
      115,
      105,
      122,
      101,
      40,
      41,
      41,
      41,
      0,
      17,
      0,
      10,
      0,
      17,
      17,
      17,
      0,
      0,
      0,
      0,
      5,
      0,
      0,
      0,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      15,
      10,
      17,
      17,
      17,
      3,
      10,
      7,
      0,
      1,
      19,
      9,
      11,
      11,
      0,
      0,
      9,
      6,
      11,
      0,
      0,
      11,
      0,
      6,
      17,
      0,
      0,
      0,
      17,
      17,
      17,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      17,
      0,
      10,
      10,
      17,
      17,
      17,
      0,
      10,
      0,
      0,
      2,
      0,
      9,
      11,
      0,
      0,
      0,
      9,
      0,
      11,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      9,
      12,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      14,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      13,
      0,
      0,
      0,
      4,
      13,
      0,
      0,
      0,
      0,
      9,
      14,
      0,
      0,
      0,
      0,
      0,
      14,
      0,
      0,
      14,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      15,
      0,
      0,
      0,
      0,
      9,
      16,
      0,
      0,
      0,
      0,
      0,
      16,
      0,
      0,
      16,
      0,
      0,
      18,
      0,
      0,
      0,
      18,
      18,
      18,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      18,
      0,
      0,
      0,
      18,
      18,
      18,
      0,
      0,
      0,
      0,
      0,
      0,
      9,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      0,
      10,
      0,
      0,
      0,
      0,
      9,
      11,
      0,
      0,
      0,
      0,
      0,
      11,
      0,
      0,
      11,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      0,
      0,
      9,
      12,
      0,
      0,
      0,
      0,
      0,
      12,
      0,
      0,
      12,
      0,
      0,
      45,
      43,
      32,
      32,
      32,
      48,
      88,
      48,
      120,
      0,
      40,
      110,
      117,
      108,
      108,
      41,
      0,
      45,
      48,
      88,
      43,
      48,
      88,
      32,
      48,
      88,
      45,
      48,
      120,
      43,
      48,
      120,
      32,
      48,
      120,
      0,
      105,
      110,
      102,
      0,
      73,
      78,
      70,
      0,
      110,
      97,
      110,
      0,
      78,
      65,
      78,
      0,
      48,
      49,
      50,
      51,
      52,
      53,
      54,
      55,
      56,
      57,
      65,
      66,
      67,
      68,
      69,
      70,
      46,
      0,
      84,
      33,
      34,
      25,
      13,
      1,
      2,
      3,
      17,
      75,
      28,
      12,
      16,
      4,
      11,
      29,
      18,
      30,
      39,
      104,
      110,
      111,
      112,
      113,
      98,
      32,
      5,
      6,
      15,
      19,
      20,
      21,
      26,
      8,
      22,
      7,
      40,
      36,
      23,
      24,
      9,
      10,
      14,
      27,
      31,
      37,
      35,
      131,
      130,
      125,
      38,
      42,
      43,
      60,
      61,
      62,
      63,
      67,
      71,
      74,
      77,
      88,
      89,
      90,
      91,
      92,
      93,
      94,
      95,
      96,
      97,
      99,
      100,
      101,
      102,
      103,
      105,
      106,
      107,
      108,
      114,
      115,
      116,
      121,
      122,
      123,
      124,
      0,
      73,
      108,
      108,
      101,
      103,
      97,
      108,
      32,
      98,
      121,
      116,
      101,
      32,
      115,
      101,
      113,
      117,
      101,
      110,
      99,
      101,
      0,
      68,
      111,
      109,
      97,
      105,
      110,
      32,
      101,
      114,
      114,
      111,
      114,
      0,
      82,
      101,
      115,
      117,
      108,
      116,
      32,
      110,
      111,
      116,
      32,
      114,
      101,
      112,
      114,
      101,
      115,
      101,
      110,
      116,
      97,
      98,
      108,
      101,
      0,
      78,
      111,
      116,
      32,
      97,
      32,
      116,
      116,
      121,
      0,
      80,
      101,
      114,
      109,
      105,
      115,
      115,
      105,
      111,
      110,
      32,
      100,
      101,
      110,
      105,
      101,
      100,
      0,
      79,
      112,
      101,
      114,
      97,
      116,
      105,
      111,
      110,
      32,
      110,
      111,
      116,
      32,
      112,
      101,
      114,
      109,
      105,
      116,
      116,
      101,
      100,
      0,
      78,
      111,
      32,
      115,
      117,
      99,
      104,
      32,
      102,
      105,
      108,
      101,
      32,
      111,
      114,
      32,
      100,
      105,
      114,
      101,
      99,
      116,
      111,
      114,
      121,
      0,
      78,
      111,
      32,
      115,
      117,
      99,
      104,
      32,
      112,
      114,
      111,
      99,
      101,
      115,
      115,
      0,
      70,
      105,
      108,
      101,
      32,
      101,
      120,
      105,
      115,
      116,
      115,
      0,
      86,
      97,
      108,
      117,
      101,
      32,
      116,
      111,
      111,
      32,
      108,
      97,
      114,
      103,
      101,
      32,
      102,
      111,
      114,
      32,
      100,
      97,
      116,
      97,
      32,
      116,
      121,
      112,
      101,
      0,
      78,
      111,
      32,
      115,
      112,
      97,
      99,
      101,
      32,
      108,
      101,
      102,
      116,
      32,
      111,
      110,
      32,
      100,
      101,
      118,
      105,
      99,
      101,
      0,
      79,
      117,
      116,
      32,
      111,
      102,
      32,
      109,
      101,
      109,
      111,
      114,
      121,
      0,
      82,
      101,
      115,
      111,
      117,
      114,
      99,
      101,
      32,
      98,
      117,
      115,
      121,
      0,
      73,
      110,
      116,
      101,
      114,
      114,
      117,
      112,
      116,
      101,
      100,
      32,
      115,
      121,
      115,
      116,
      101,
      109,
      32,
      99,
      97,
      108,
      108,
      0,
      82,
      101,
      115,
      111,
      117,
      114,
      99,
      101,
      32,
      116,
      101,
      109,
      112,
      111,
      114,
      97,
      114,
      105,
      108,
      121,
      32,
      117,
      110,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      73,
      110,
      118,
      97,
      108,
      105,
      100,
      32,
      115,
      101,
      101,
      107,
      0,
      67,
      114,
      111,
      115,
      115,
      45,
      100,
      101,
      118,
      105,
      99,
      101,
      32,
      108,
      105,
      110,
      107,
      0,
      82,
      101,
      97,
      100,
      45,
      111,
      110,
      108,
      121,
      32,
      102,
      105,
      108,
      101,
      32,
      115,
      121,
      115,
      116,
      101,
      109,
      0,
      68,
      105,
      114,
      101,
      99,
      116,
      111,
      114,
      121,
      32,
      110,
      111,
      116,
      32,
      101,
      109,
      112,
      116,
      121,
      0,
      67,
      111,
      110,
      110,
      101,
      99,
      116,
      105,
      111,
      110,
      32,
      114,
      101,
      115,
      101,
      116,
      32,
      98,
      121,
      32,
      112,
      101,
      101,
      114,
      0,
      79,
      112,
      101,
      114,
      97,
      116,
      105,
      111,
      110,
      32,
      116,
      105,
      109,
      101,
      100,
      32,
      111,
      117,
      116,
      0,
      67,
      111,
      110,
      110,
      101,
      99,
      116,
      105,
      111,
      110,
      32,
      114,
      101,
      102,
      117,
      115,
      101,
      100,
      0,
      72,
      111,
      115,
      116,
      32,
      105,
      115,
      32,
      100,
      111,
      119,
      110,
      0,
      72,
      111,
      115,
      116,
      32,
      105,
      115,
      32,
      117,
      110,
      114,
      101,
      97,
      99,
      104,
      97,
      98,
      108,
      101,
      0,
      65,
      100,
      100,
      114,
      101,
      115,
      115,
      32,
      105,
      110,
      32,
      117,
      115,
      101,
      0,
      66,
      114,
      111,
      107,
      101,
      110,
      32,
      112,
      105,
      112,
      101,
      0,
      73,
      47,
      79,
      32,
      101,
      114,
      114,
      111,
      114,
      0,
      78,
      111,
      32,
      115,
      117,
      99,
      104,
      32,
      100,
      101,
      118,
      105,
      99,
      101,
      32,
      111,
      114,
      32,
      97,
      100,
      100,
      114,
      101,
      115,
      115,
      0,
      66,
      108,
      111,
      99,
      107,
      32,
      100,
      101,
      118,
      105,
      99,
      101,
      32,
      114,
      101,
      113,
      117,
      105,
      114,
      101,
      100,
      0,
      78,
      111,
      32,
      115,
      117,
      99,
      104,
      32,
      100,
      101,
      118,
      105,
      99,
      101,
      0,
      78,
      111,
      116,
      32,
      97,
      32,
      100,
      105,
      114,
      101,
      99,
      116,
      111,
      114,
      121,
      0,
      73,
      115,
      32,
      97,
      32,
      100,
      105,
      114,
      101,
      99,
      116,
      111,
      114,
      121,
      0,
      84,
      101,
      120,
      116,
      32,
      102,
      105,
      108,
      101,
      32,
      98,
      117,
      115,
      121,
      0,
      69,
      120,
      101,
      99,
      32,
      102,
      111,
      114,
      109,
      97,
      116,
      32,
      101,
      114,
      114,
      111,
      114,
      0,
      73,
      110,
      118,
      97,
      108,
      105,
      100,
      32,
      97,
      114,
      103,
      117,
      109,
      101,
      110,
      116,
      0,
      65,
      114,
      103,
      117,
      109,
      101,
      110,
      116,
      32,
      108,
      105,
      115,
      116,
      32,
      116,
      111,
      111,
      32,
      108,
      111,
      110,
      103,
      0,
      83,
      121,
      109,
      98,
      111,
      108,
      105,
      99,
      32,
      108,
      105,
      110,
      107,
      32,
      108,
      111,
      111,
      112,
      0,
      70,
      105,
      108,
      101,
      110,
      97,
      109,
      101,
      32,
      116,
      111,
      111,
      32,
      108,
      111,
      110,
      103,
      0,
      84,
      111,
      111,
      32,
      109,
      97,
      110,
      121,
      32,
      111,
      112,
      101,
      110,
      32,
      102,
      105,
      108,
      101,
      115,
      32,
      105,
      110,
      32,
      115,
      121,
      115,
      116,
      101,
      109,
      0,
      78,
      111,
      32,
      102,
      105,
      108,
      101,
      32,
      100,
      101,
      115,
      99,
      114,
      105,
      112,
      116,
      111,
      114,
      115,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      66,
      97,
      100,
      32,
      102,
      105,
      108,
      101,
      32,
      100,
      101,
      115,
      99,
      114,
      105,
      112,
      116,
      111,
      114,
      0,
      78,
      111,
      32,
      99,
      104,
      105,
      108,
      100,
      32,
      112,
      114,
      111,
      99,
      101,
      115,
      115,
      0,
      66,
      97,
      100,
      32,
      97,
      100,
      100,
      114,
      101,
      115,
      115,
      0,
      70,
      105,
      108,
      101,
      32,
      116,
      111,
      111,
      32,
      108,
      97,
      114,
      103,
      101,
      0,
      84,
      111,
      111,
      32,
      109,
      97,
      110,
      121,
      32,
      108,
      105,
      110,
      107,
      115,
      0,
      78,
      111,
      32,
      108,
      111,
      99,
      107,
      115,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      82,
      101,
      115,
      111,
      117,
      114,
      99,
      101,
      32,
      100,
      101,
      97,
      100,
      108,
      111,
      99,
      107,
      32,
      119,
      111,
      117,
      108,
      100,
      32,
      111,
      99,
      99,
      117,
      114,
      0,
      83,
      116,
      97,
      116,
      101,
      32,
      110,
      111,
      116,
      32,
      114,
      101,
      99,
      111,
      118,
      101,
      114,
      97,
      98,
      108,
      101,
      0,
      80,
      114,
      101,
      118,
      105,
      111,
      117,
      115,
      32,
      111,
      119,
      110,
      101,
      114,
      32,
      100,
      105,
      101,
      100,
      0,
      79,
      112,
      101,
      114,
      97,
      116,
      105,
      111,
      110,
      32,
      99,
      97,
      110,
      99,
      101,
      108,
      101,
      100,
      0,
      70,
      117,
      110,
      99,
      116,
      105,
      111,
      110,
      32,
      110,
      111,
      116,
      32,
      105,
      109,
      112,
      108,
      101,
      109,
      101,
      110,
      116,
      101,
      100,
      0,
      78,
      111,
      32,
      109,
      101,
      115,
      115,
      97,
      103,
      101,
      32,
      111,
      102,
      32,
      100,
      101,
      115,
      105,
      114,
      101,
      100,
      32,
      116,
      121,
      112,
      101,
      0,
      73,
      100,
      101,
      110,
      116,
      105,
      102,
      105,
      101,
      114,
      32,
      114,
      101,
      109,
      111,
      118,
      101,
      100,
      0,
      68,
      101,
      118,
      105,
      99,
      101,
      32,
      110,
      111,
      116,
      32,
      97,
      32,
      115,
      116,
      114,
      101,
      97,
      109,
      0,
      78,
      111,
      32,
      100,
      97,
      116,
      97,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      68,
      101,
      118,
      105,
      99,
      101,
      32,
      116,
      105,
      109,
      101,
      111,
      117,
      116,
      0,
      79,
      117,
      116,
      32,
      111,
      102,
      32,
      115,
      116,
      114,
      101,
      97,
      109,
      115,
      32,
      114,
      101,
      115,
      111,
      117,
      114,
      99,
      101,
      115,
      0,
      76,
      105,
      110,
      107,
      32,
      104,
      97,
      115,
      32,
      98,
      101,
      101,
      110,
      32,
      115,
      101,
      118,
      101,
      114,
      101,
      100,
      0,
      80,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      32,
      101,
      114,
      114,
      111,
      114,
      0,
      66,
      97,
      100,
      32,
      109,
      101,
      115,
      115,
      97,
      103,
      101,
      0,
      70,
      105,
      108,
      101,
      32,
      100,
      101,
      115,
      99,
      114,
      105,
      112,
      116,
      111,
      114,
      32,
      105,
      110,
      32,
      98,
      97,
      100,
      32,
      115,
      116,
      97,
      116,
      101,
      0,
      78,
      111,
      116,
      32,
      97,
      32,
      115,
      111,
      99,
      107,
      101,
      116,
      0,
      68,
      101,
      115,
      116,
      105,
      110,
      97,
      116,
      105,
      111,
      110,
      32,
      97,
      100,
      100,
      114,
      101,
      115,
      115,
      32,
      114,
      101,
      113,
      117,
      105,
      114,
      101,
      100,
      0,
      77,
      101,
      115,
      115,
      97,
      103,
      101,
      32,
      116,
      111,
      111,
      32,
      108,
      97,
      114,
      103,
      101,
      0,
      80,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      32,
      119,
      114,
      111,
      110,
      103,
      32,
      116,
      121,
      112,
      101,
      32,
      102,
      111,
      114,
      32,
      115,
      111,
      99,
      107,
      101,
      116,
      0,
      80,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      32,
      110,
      111,
      116,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      80,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      0,
      83,
      111,
      99,
      107,
      101,
      116,
      32,
      116,
      121,
      112,
      101,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      0,
      78,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      0,
      80,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      32,
      102,
      97,
      109,
      105,
      108,
      121,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      0,
      65,
      100,
      100,
      114,
      101,
      115,
      115,
      32,
      102,
      97,
      109,
      105,
      108,
      121,
      32,
      110,
      111,
      116,
      32,
      115,
      117,
      112,
      112,
      111,
      114,
      116,
      101,
      100,
      32,
      98,
      121,
      32,
      112,
      114,
      111,
      116,
      111,
      99,
      111,
      108,
      0,
      65,
      100,
      100,
      114,
      101,
      115,
      115,
      32,
      110,
      111,
      116,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      78,
      101,
      116,
      119,
      111,
      114,
      107,
      32,
      105,
      115,
      32,
      100,
      111,
      119,
      110,
      0,
      78,
      101,
      116,
      119,
      111,
      114,
      107,
      32,
      117,
      110,
      114,
      101,
      97,
      99,
      104,
      97,
      98,
      108,
      101,
      0,
      67,
      111,
      110,
      110,
      101,
      99,
      116,
      105,
      111,
      110,
      32,
      114,
      101,
      115,
      101,
      116,
      32,
      98,
      121,
      32,
      110,
      101,
      116,
      119,
      111,
      114,
      107,
      0,
      67,
      111,
      110,
      110,
      101,
      99,
      116,
      105,
      111,
      110,
      32,
      97,
      98,
      111,
      114,
      116,
      101,
      100,
      0,
      78,
      111,
      32,
      98,
      117,
      102,
      102,
      101,
      114,
      32,
      115,
      112,
      97,
      99,
      101,
      32,
      97,
      118,
      97,
      105,
      108,
      97,
      98,
      108,
      101,
      0,
      83,
      111,
      99,
      107,
      101,
      116,
      32,
      105,
      115,
      32,
      99,
      111,
      110,
      110,
      101,
      99,
      116,
      101,
      100,
      0,
      83,
      111,
      99,
      107,
      101,
      116,
      32,
      110,
      111,
      116,
      32,
      99,
      111,
      110,
      110,
      101,
      99,
      116,
      101,
      100,
      0,
      67,
      97,
      110,
      110,
      111,
      116,
      32,
      115,
      101,
      110,
      100,
      32,
      97,
      102,
      116,
      101,
      114,
      32,
      115,
      111,
      99,
      107,
      101,
      116,
      32,
      115,
      104,
      117,
      116,
      100,
      111,
      119,
      110,
      0,
      79,
      112,
      101,
      114,
      97,
      116,
      105,
      111,
      110,
      32,
      97,
      108,
      114,
      101,
      97,
      100,
      121,
      32,
      105,
      110,
      32,
      112,
      114,
      111,
      103,
      114,
      101,
      115,
      115,
      0,
      79,
      112,
      101,
      114,
      97,
      116,
      105,
      111,
      110,
      32,
      105,
      110,
      32,
      112,
      114,
      111,
      103,
      114,
      101,
      115,
      115,
      0,
      83,
      116,
      97,
      108,
      101,
      32,
      102,
      105,
      108,
      101,
      32,
      104,
      97,
      110,
      100,
      108,
      101,
      0,
      82,
      101,
      109,
      111,
      116,
      101,
      32,
      73,
      47,
      79,
      32,
      101,
      114,
      114,
      111,
      114,
      0,
      81,
      117,
      111,
      116,
      97,
      32,
      101,
      120,
      99,
      101,
      101,
      100,
      101,
      100,
      0,
      78,
      111,
      32,
      109,
      101,
      100,
      105,
      117,
      109,
      32,
      102,
      111,
      117,
      110,
      100,
      0,
      87,
      114,
      111,
      110,
      103,
      32,
      109,
      101,
      100,
      105,
      117,
      109,
      32,
      116,
      121,
      112,
      101,
      0,
      78,
      111,
      32,
      101,
      114,
      114,
      111,
      114,
      32,
      105,
      110,
      102,
      111,
      114,
      109,
      97,
      116,
      105,
      111,
      110,
      0,
      0,
      33,
      34,
      118,
      101,
      99,
      116,
      111,
      114,
      32,
      108,
      101,
      110,
      103,
      116,
      104,
      95,
      101,
      114,
      114,
      111,
      114,
      34,
      0,
      47,
      117,
      115,
      114,
      47,
      108,
      111,
      99,
      97,
      108,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      104,
      111,
      109,
      101,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      100,
      101,
      118,
      101,
      47,
      101,
      109,
      115,
      100,
      107,
      95,
      119,
      97,
      115,
      109,
      47,
      101,
      109,
      115,
      100,
      107,
      47,
      101,
      109,
      115,
      99,
      114,
      105,
      112,
      116,
      101,
      110,
      47,
      105,
      110,
      99,
      111,
      109,
      105,
      110,
      103,
      47,
      115,
      121,
      115,
      116,
      101,
      109,
      47,
      105,
      110,
      99,
      108,
      117,
      100,
      101,
      47,
      108,
      105,
      98,
      99,
      120,
      120,
      47,
      118,
      101,
      99,
      116,
      111,
      114,
      0,
      33,
      34,
      118,
      101,
      99,
      116,
      111,
      114,
      32,
      111,
      117,
      116,
      95,
      111,
      102,
      95,
      114,
      97,
      110,
      103,
      101,
      34,
      0,
      33,
      34,
      98,
      97,
      115,
      105,
      99,
      95,
      115,
      116,
      114,
      105,
      110,
      103,
      32,
      108,
      101,
      110,
      103,
      116,
      104,
      95,
      101,
      114,
      114,
      111,
      114,
      34,
      0,
      47,
      117,
      115,
      114,
      47,
      108,
      111,
      99,
      97,
      108,
      47,
      103,
      111,
      111,
      103,
      108,
      101,
      47,
      104,
      111,
      109,
      101,
      47,
      111,
      115,
      116,
      97,
      118,
      97,
      47,
      100,
      101,
      118,
      101,
      47,
      101,
      109,
      115,
      100,
      107,
      95,
      119,
      97,
      115,
      109,
      47,
      101,
      109,
      115,
      100,
      107,
      47,
      101,
      109,
      115,
      99,
      114,
      105,
      112,
      116,
      101,
      110,
      47,
      105,
      110,
      99,
      111,
      109,
      105,
      110,
      103,
      47,
      115,
      121,
      115,
      116,
      101,
      109,
      47,
      105,
      110,
      99,
      108,
      117,
      100,
      101,
      47,
      108,
      105,
      98,
      99,
      120,
      120,
      47,
      115,
      116,
      114,
      105,
      110,
      103,
      0,
      95,
      95,
      116,
      104,
      114,
      111,
      119,
      95,
      108,
      101,
      110,
      103,
      116,
      104,
      95,
      101,
      114,
      114,
      111,
      114,
      0,
      33,
      34,
      98,
      97,
      115,
      105,
      99,
      95,
      115,
      116,
      114,
      105,
      110,
      103,
      32,
      111,
      117,
      116,
      95,
      111,
      102,
      95,
      114,
      97,
      110,
      103,
      101,
      34,
      0,
      95,
      95,
      116,
      104,
      114,
      111,
      119,
      95,
      111,
      117,
      116,
      95,
      111,
      102,
      95,
      114,
      97,
      110,
      103,
      101,
      0,
      116,
      101,
      114,
      109,
      105,
      110,
      97,
      116,
      105,
      110,
      103,
      32,
      119,
      105,
      116,
      104,
      32,
      37,
      115,
      32,
      101,
      120,
      99,
      101,
      112,
      116,
      105,
      111,
      110,
      32,
      111,
      102,
      32,
      116,
      121,
      112,
      101,
      32,
      37,
      115,
      58,
      32,
      37,
      115,
      0,
      116,
      101,
      114,
      109,
      105,
      110,
      97,
      116,
      105,
      110,
      103,
      32,
      119,
      105,
      116,
      104,
      32,
      37,
      115,
      32,
      101,
      120,
      99,
      101,
      112,
      116,
      105,
      111,
      110,
      32,
      111,
      102,
      32,
      116,
      121,
      112,
      101,
      32,
      37,
      115,
      0,
      116,
      101,
      114,
      109,
      105,
      110,
      97,
      116,
      105,
      110,
      103,
      32,
      119,
      105,
      116,
      104,
      32,
      37,
      115,
      32,
      102,
      111,
      114,
      101,
      105,
      103,
      110,
      32,
      101,
      120,
      99,
      101,
      112,
      116,
      105,
      111,
      110,
      0,
      116,
      101,
      114,
      109,
      105,
      110,
      97,
      116,
      105,
      110,
      103,
      0,
      117,
      110,
      99,
      97,
      117,
      103,
      104,
      116,
      0,
      83,
      116,
      57,
      101,
      120,
      99,
      101,
      112,
      116,
      105,
      111,
      110,
      0,
      78,
      49,
      48,
      95,
      95,
      99,
      120,
      120,
      97,
      98,
      105,
      118,
      49,
      49,
      54,
      95,
      95,
      115,
      104,
      105,
      109,
      95,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      69,
      0,
      83,
      116,
      57,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      0,
      78,
      49,
      48,
      95,
      95,
      99,
      120,
      120,
      97,
      98,
      105,
      118,
      49,
      50,
      48,
      95,
      95,
      115,
      105,
      95,
      99,
      108,
      97,
      115,
      115,
      95,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      69,
      0,
      78,
      49,
      48,
      95,
      95,
      99,
      120,
      120,
      97,
      98,
      105,
      118,
      49,
      49,
      55,
      95,
      95,
      99,
      108,
      97,
      115,
      115,
      95,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      69,
      0,
      112,
      116,
      104,
      114,
      101,
      97,
      100,
      95,
      111,
      110,
      99,
      101,
      32,
      102,
      97,
      105,
      108,
      117,
      114,
      101,
      32,
      105,
      110,
      32,
      95,
      95,
      99,
      120,
      97,
      95,
      103,
      101,
      116,
      95,
      103,
      108,
      111,
      98,
      97,
      108,
      115,
      95,
      102,
      97,
      115,
      116,
      40,
      41,
      0,
      99,
      97,
      110,
      110,
      111,
      116,
      32,
      99,
      114,
      101,
      97,
      116,
      101,
      32,
      112,
      116,
      104,
      114,
      101,
      97,
      100,
      32,
      107,
      101,
      121,
      32,
      102,
      111,
      114,
      32,
      95,
      95,
      99,
      120,
      97,
      95,
      103,
      101,
      116,
      95,
      103,
      108,
      111,
      98,
      97,
      108,
      115,
      40,
      41,
      0,
      99,
      97,
      110,
      110,
      111,
      116,
      32,
      122,
      101,
      114,
      111,
      32,
      111,
      117,
      116,
      32,
      116,
      104,
      114,
      101,
      97,
      100,
      32,
      118,
      97,
      108,
      117,
      101,
      32,
      102,
      111,
      114,
      32,
      95,
      95,
      99,
      120,
      97,
      95,
      103,
      101,
      116,
      95,
      103,
      108,
      111,
      98,
      97,
      108,
      115,
      40,
      41,
      0,
      116,
      101,
      114,
      109,
      105,
      110,
      97,
      116,
      101,
      95,
      104,
      97,
      110,
      100,
      108,
      101,
      114,
      32,
      117,
      110,
      101,
      120,
      112,
      101,
      99,
      116,
      101,
      100,
      108,
      121,
      32,
      114,
      101,
      116,
      117,
      114,
      110,
      101,
      100,
      0,
      115,
      116,
      100,
      58,
      58,
      98,
      97,
      100,
      95,
      97,
      108,
      108,
      111,
      99,
      0,
      83,
      116,
      57,
      98,
      97,
      100,
      95,
      97,
      108,
      108,
      111,
      99,
      0,
      78,
      49,
      48,
      95,
      95,
      99,
      120,
      120,
      97,
      98,
      105,
      118,
      49,
      49,
      57,
      95,
      95,
      112,
      111,
      105,
      110,
      116,
      101,
      114,
      95,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      69,
      0,
      78,
      49,
      48,
      95,
      95,
      99,
      120,
      120,
      97,
      98,
      105,
      118,
      49,
      49,
      55,
      95,
      95,
      112,
      98,
      97,
      115,
      101,
      95,
      116,
      121,
      112,
      101,
      95,
      105,
      110,
      102,
      111,
      69,
      0,
    ],
    'i8',
    ALLOC_NONE,
    Runtime.GLOBAL_BASE + 20480
  );
  var tempDoublePtr = STATICTOP;
  STATICTOP += 16;
  Module['_i64Subtract'] = _i64Subtract;
  function ___assert_fail(condition, filename, line, func) {
    ABORT = true;
    throw 'Assertion failed: ' +
      Pointer_stringify(condition) +
      ', at: ' +
      [
        filename ? Pointer_stringify(filename) : 'unknown filename',
        line,
        func ? Pointer_stringify(func) : 'unknown function',
      ] +
      ' at ' +
      stackTrace();
  }
  function __ZSt18uncaught_exceptionv() {
    return !!__ZSt18uncaught_exceptionv.uncaught_exception;
  }
  var EXCEPTIONS = {
    last: 0,
    caught: [],
    infos: {},
    deAdjust: function(adjusted) {
      if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
      for (var ptr in EXCEPTIONS.infos) {
        var info = EXCEPTIONS.infos[ptr];
        if (info.adjusted === adjusted) {
          return ptr;
        }
      }
      return adjusted;
    },
    addRef: function(ptr) {
      if (!ptr) return;
      var info = EXCEPTIONS.infos[ptr];
      info.refcount++;
    },
    decRef: function(ptr) {
      if (!ptr) return;
      var info = EXCEPTIONS.infos[ptr];
      assert(info.refcount > 0);
      info.refcount--;
      if (info.refcount === 0 && !info.rethrown) {
        if (info.destructor) {
          Module['dynCall_vi'](info.destructor, ptr);
        }
        delete EXCEPTIONS.infos[ptr];
        ___cxa_free_exception(ptr);
      }
    },
    clearRef: function(ptr) {
      if (!ptr) return;
      var info = EXCEPTIONS.infos[ptr];
      info.refcount = 0;
    },
  };
  function ___resumeException(ptr) {
    if (!EXCEPTIONS.last) {
      EXCEPTIONS.last = ptr;
    }
    throw ptr +
      ' - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.';
  }
  function ___cxa_find_matching_catch() {
    var thrown = EXCEPTIONS.last;
    if (!thrown) {
      return (Runtime.setTempRet0(0), 0) | 0;
    }
    var info = EXCEPTIONS.infos[thrown];
    var throwntype = info.type;
    if (!throwntype) {
      return (Runtime.setTempRet0(0), thrown) | 0;
    }
    var typeArray = Array.prototype.slice.call(arguments);
    var pointer = Module['___cxa_is_pointer_type'](throwntype);
    if (!___cxa_find_matching_catch.buffer)
      ___cxa_find_matching_catch.buffer = _malloc(4);
    HEAP32[___cxa_find_matching_catch.buffer >> 2] = thrown;
    thrown = ___cxa_find_matching_catch.buffer;
    for (var i = 0; i < typeArray.length; i++) {
      if (
        typeArray[i] &&
        Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)
      ) {
        thrown = HEAP32[thrown >> 2];
        info.adjusted = thrown;
        return (Runtime.setTempRet0(typeArray[i]), thrown) | 0;
      }
    }
    thrown = HEAP32[thrown >> 2];
    return (Runtime.setTempRet0(throwntype), thrown) | 0;
  }
  function ___cxa_throw(ptr, type, destructor) {
    EXCEPTIONS.infos[ptr] = {
      ptr: ptr,
      adjusted: ptr,
      type: type,
      destructor: destructor,
      refcount: 0,
      caught: false,
      rethrown: false,
    };
    EXCEPTIONS.last = ptr;
    if (!('uncaught_exception' in __ZSt18uncaught_exceptionv)) {
      __ZSt18uncaught_exceptionv.uncaught_exception = 1;
    } else {
      __ZSt18uncaught_exceptionv.uncaught_exception++;
    }
    throw ptr +
      ' - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.';
  }
  Module['_memset'] = _memset;
  Module['_bitshift64Shl'] = _bitshift64Shl;
  function _abort() {
    Module['abort']();
  }
  function _pthread_once(ptr, func) {
    if (!_pthread_once.seen) _pthread_once.seen = {};
    if (ptr in _pthread_once.seen) return;
    Module['dynCall_v'](func);
    _pthread_once.seen[ptr] = 1;
  }
  Module['_i64Add'] = _i64Add;
  var cttz_i8 = allocate(
    [
      8,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      5,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      6,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      5,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      7,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      5,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      6,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      5,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      4,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
      3,
      0,
      1,
      0,
      2,
      0,
      1,
      0,
    ],
    'i8',
    ALLOC_STATIC
  );
  Module['_llvm_cttz_i32'] = _llvm_cttz_i32;
  Module['___udivmoddi4'] = ___udivmoddi4;
  Module['___divdi3'] = ___divdi3;
  var PTHREAD_SPECIFIC = {};
  function _pthread_getspecific(key) {
    return PTHREAD_SPECIFIC[key] || 0;
  }
  var PTHREAD_SPECIFIC_NEXT_KEY = 1;
  var ERRNO_CODES = {
    EPERM: 1,
    ENOENT: 2,
    ESRCH: 3,
    EINTR: 4,
    EIO: 5,
    ENXIO: 6,
    E2BIG: 7,
    ENOEXEC: 8,
    EBADF: 9,
    ECHILD: 10,
    EAGAIN: 11,
    EWOULDBLOCK: 11,
    ENOMEM: 12,
    EACCES: 13,
    EFAULT: 14,
    ENOTBLK: 15,
    EBUSY: 16,
    EEXIST: 17,
    EXDEV: 18,
    ENODEV: 19,
    ENOTDIR: 20,
    EISDIR: 21,
    EINVAL: 22,
    ENFILE: 23,
    EMFILE: 24,
    ENOTTY: 25,
    ETXTBSY: 26,
    EFBIG: 27,
    ENOSPC: 28,
    ESPIPE: 29,
    EROFS: 30,
    EMLINK: 31,
    EPIPE: 32,
    EDOM: 33,
    ERANGE: 34,
    ENOMSG: 42,
    EIDRM: 43,
    ECHRNG: 44,
    EL2NSYNC: 45,
    EL3HLT: 46,
    EL3RST: 47,
    ELNRNG: 48,
    EUNATCH: 49,
    ENOCSI: 50,
    EL2HLT: 51,
    EDEADLK: 35,
    ENOLCK: 37,
    EBADE: 52,
    EBADR: 53,
    EXFULL: 54,
    ENOANO: 55,
    EBADRQC: 56,
    EBADSLT: 57,
    EDEADLOCK: 35,
    EBFONT: 59,
    ENOSTR: 60,
    ENODATA: 61,
    ETIME: 62,
    ENOSR: 63,
    ENONET: 64,
    ENOPKG: 65,
    EREMOTE: 66,
    ENOLINK: 67,
    EADV: 68,
    ESRMNT: 69,
    ECOMM: 70,
    EPROTO: 71,
    EMULTIHOP: 72,
    EDOTDOT: 73,
    EBADMSG: 74,
    ENOTUNIQ: 76,
    EBADFD: 77,
    EREMCHG: 78,
    ELIBACC: 79,
    ELIBBAD: 80,
    ELIBSCN: 81,
    ELIBMAX: 82,
    ELIBEXEC: 83,
    ENOSYS: 38,
    ENOTEMPTY: 39,
    ENAMETOOLONG: 36,
    ELOOP: 40,
    EOPNOTSUPP: 95,
    EPFNOSUPPORT: 96,
    ECONNRESET: 104,
    ENOBUFS: 105,
    EAFNOSUPPORT: 97,
    EPROTOTYPE: 91,
    ENOTSOCK: 88,
    ENOPROTOOPT: 92,
    ESHUTDOWN: 108,
    ECONNREFUSED: 111,
    EADDRINUSE: 98,
    ECONNABORTED: 103,
    ENETUNREACH: 101,
    ENETDOWN: 100,
    ETIMEDOUT: 110,
    EHOSTDOWN: 112,
    EHOSTUNREACH: 113,
    EINPROGRESS: 115,
    EALREADY: 114,
    EDESTADDRREQ: 89,
    EMSGSIZE: 90,
    EPROTONOSUPPORT: 93,
    ESOCKTNOSUPPORT: 94,
    EADDRNOTAVAIL: 99,
    ENETRESET: 102,
    EISCONN: 106,
    ENOTCONN: 107,
    ETOOMANYREFS: 109,
    EUSERS: 87,
    EDQUOT: 122,
    ESTALE: 116,
    ENOTSUP: 95,
    ENOMEDIUM: 123,
    EILSEQ: 84,
    EOVERFLOW: 75,
    ECANCELED: 125,
    ENOTRECOVERABLE: 131,
    EOWNERDEAD: 130,
    ESTRPIPE: 86,
  };
  function _pthread_key_create(key, destructor) {
    if (key == 0) {
      return ERRNO_CODES.EINVAL;
    }
    HEAP32[key >> 2] = PTHREAD_SPECIFIC_NEXT_KEY;
    PTHREAD_SPECIFIC[PTHREAD_SPECIFIC_NEXT_KEY] = 0;
    PTHREAD_SPECIFIC_NEXT_KEY++;
    return 0;
  }
  function _pthread_setspecific(key, value) {
    if (!(key in PTHREAD_SPECIFIC)) {
      return ERRNO_CODES.EINVAL;
    }
    PTHREAD_SPECIFIC[key] = value;
    return 0;
  }
  function ___cxa_allocate_exception(size) {
    return _malloc(size);
  }
  var SYSCALLS = {
    varargs: 0,
    get: function(varargs) {
      SYSCALLS.varargs += 4;
      var ret = HEAP32[(SYSCALLS.varargs - 4) >> 2];
      return ret;
    },
    getStr: function() {
      var ret = Pointer_stringify(SYSCALLS.get());
      return ret;
    },
    get64: function() {
      var low = SYSCALLS.get(),
        high = SYSCALLS.get();
      if (low >= 0) assert(high === 0);
      else assert(high === -1);
      return low;
    },
    getZero: function() {
      assert(SYSCALLS.get() === 0);
    },
  };
  function ___syscall54(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      return 0;
    } catch (e) {
      if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno;
    }
  }
  Module['_bitshift64Ashr'] = _bitshift64Ashr;
  Module['_bitshift64Lshr'] = _bitshift64Lshr;
  function ___cxa_pure_virtual() {
    ABORT = true;
    throw 'Pure virtual function called!';
  }
  function ___cxa_begin_catch(ptr) {
    var info = EXCEPTIONS.infos[ptr];
    if (info && !info.caught) {
      info.caught = true;
      __ZSt18uncaught_exceptionv.uncaught_exception--;
    }
    if (info) info.rethrown = false;
    EXCEPTIONS.caught.push(ptr);
    EXCEPTIONS.addRef(EXCEPTIONS.deAdjust(ptr));
    return ptr;
  }
  function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.set(HEAPU8.subarray(src, src + num), dest);
    return dest;
  }
  Module['_memcpy'] = _memcpy;
  function ___syscall6(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
      if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno;
    }
  }
  Module['___udivdi3'] = ___udivdi3;
  Module['___muldsi3'] = ___muldsi3;
  Module['___muldi3'] = ___muldi3;
  function ___setErrNo(value) {
    if (Module['___errno_location'])
      HEAP32[Module['___errno_location']() >> 2] = value;
    return value;
  }
  Module['_sbrk'] = _sbrk;
  Module['_memmove'] = _memmove;
  function ___gxx_personality_v0() {}
  Module['___uremdi3'] = ___uremdi3;
  Module['_llvm_bswap_i32'] = _llvm_bswap_i32;
  function ___syscall140(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.getStreamFromFD(),
        offset_high = SYSCALLS.get(),
        offset_low = SYSCALLS.get(),
        result = SYSCALLS.get(),
        whence = SYSCALLS.get();
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[result >> 2] = stream.position;
      if (stream.getdents && offset === 0 && whence === 0)
        stream.getdents = null;
      return 0;
    } catch (e) {
      if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno;
    }
  }
  function ___syscall146(which, varargs) {
    SYSCALLS.varargs = varargs;
    try {
      var stream = SYSCALLS.get(),
        iov = SYSCALLS.get(),
        iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []];
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(
              UTF8ArrayToString(buffer, 0)
            );
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(iov + i * 8) >> 2];
        var len = HEAP32[(iov + (i * 8 + 4)) >> 2];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr + j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
      if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
      return -e.errno;
    }
  }
  __ATEXIT__.push(function() {
    var fflush = Module['_fflush'];
    if (fflush) fflush(0);
    var printChar = ___syscall146.printChar;
    if (!printChar) return;
    var buffers = ___syscall146.buffers;
    if (buffers[1].length) printChar(1, 10);
    if (buffers[2].length) printChar(2, 10);
  });
  DYNAMICTOP_PTR = allocate(1, 'i32', ALLOC_STATIC);
  STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
  STACK_MAX = STACK_BASE + TOTAL_STACK;
  DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);
  HEAP32[DYNAMICTOP_PTR >> 2] = DYNAMIC_BASE;
  staticSealed = true;
  function invoke_iiii(index, a1, a2, a3) {
    try {
      return Module['dynCall_iiii'](index, a1, a2, a3);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_viiiii(index, a1, a2, a3, a4, a5) {
    try {
      Module['dynCall_viiiii'](index, a1, a2, a3, a4, a5);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_vi(index, a1) {
    try {
      Module['dynCall_vi'](index, a1);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_vii(index, a1, a2) {
    try {
      Module['dynCall_vii'](index, a1, a2);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_iiiiiii(index, a1, a2, a3, a4, a5, a6) {
    try {
      return Module['dynCall_iiiiiii'](index, a1, a2, a3, a4, a5, a6);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_ii(index, a1) {
    try {
      return Module['dynCall_ii'](index, a1);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_viii(index, a1, a2, a3) {
    try {
      Module['dynCall_viii'](index, a1, a2, a3);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_v(index) {
    try {
      Module['dynCall_v'](index);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_viiiiii(index, a1, a2, a3, a4, a5, a6) {
    try {
      Module['dynCall_viiiiii'](index, a1, a2, a3, a4, a5, a6);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_iii(index, a1, a2) {
    try {
      return Module['dynCall_iii'](index, a1, a2);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  function invoke_viiii(index, a1, a2, a3, a4) {
    try {
      Module['dynCall_viiii'](index, a1, a2, a3, a4);
    } catch (e) {
      if (typeof e !== 'number' && e !== 'longjmp') throw e;
      Module['setThrew'](1, 0);
    }
  }
  Module.asmGlobalArg = {
    Math: Math,
    Int8Array: Int8Array,
    Int16Array: Int16Array,
    Int32Array: Int32Array,
    Uint8Array: Uint8Array,
    Uint16Array: Uint16Array,
    Uint32Array: Uint32Array,
    Float32Array: Float32Array,
    Float64Array: Float64Array,
    NaN: NaN,
    Infinity: Infinity,
    byteLength: byteLength,
  };
  Module.asmLibraryArg = {
    abort: abort,
    assert: assert,
    enlargeMemory: enlargeMemory,
    getTotalMemory: getTotalMemory,
    abortOnCannotGrowMemory: abortOnCannotGrowMemory,
    invoke_iiii: invoke_iiii,
    invoke_viiiii: invoke_viiiii,
    invoke_vi: invoke_vi,
    invoke_vii: invoke_vii,
    invoke_iiiiiii: invoke_iiiiiii,
    invoke_ii: invoke_ii,
    invoke_viii: invoke_viii,
    invoke_v: invoke_v,
    invoke_viiiiii: invoke_viiiiii,
    invoke_iii: invoke_iii,
    invoke_viiii: invoke_viiii,
    _pthread_getspecific: _pthread_getspecific,
    _pthread_setspecific: _pthread_setspecific,
    ___cxa_throw: ___cxa_throw,
    ___gxx_personality_v0: ___gxx_personality_v0,
    ___syscall6: ___syscall6,
    ___setErrNo: ___setErrNo,
    _abort: _abort,
    ___cxa_begin_catch: ___cxa_begin_catch,
    _pthread_key_create: _pthread_key_create,
    ___syscall146: ___syscall146,
    _pthread_once: _pthread_once,
    _emscripten_memcpy_big: _emscripten_memcpy_big,
    ___syscall54: ___syscall54,
    ___syscall140: ___syscall140,
    ___resumeException: ___resumeException,
    ___cxa_find_matching_catch: ___cxa_find_matching_catch,
    ___assert_fail: ___assert_fail,
    ___cxa_pure_virtual: ___cxa_pure_virtual,
    ___cxa_allocate_exception: ___cxa_allocate_exception,
    __ZSt18uncaught_exceptionv: __ZSt18uncaught_exceptionv,
    DYNAMICTOP_PTR: DYNAMICTOP_PTR,
    tempDoublePtr: tempDoublePtr,
    ABORT: ABORT,
    STACKTOP: STACKTOP,
    STACK_MAX: STACK_MAX,
    cttz_i8: cttz_i8,
  }; // EMSCRIPTEN_START_ASM
  var asm = (function(global, env, buffer) {
    'almost asm';
    var a = global.Int8Array;
    var b = new a(buffer);
    var c = global.Int16Array;
    var d = new c(buffer);
    var e = global.Int32Array;
    var f = new e(buffer);
    var g = global.Uint8Array;
    var h = new g(buffer);
    var i = global.Uint16Array;
    var j = new i(buffer);
    var k = global.Uint32Array;
    var l = new k(buffer);
    var m = global.Float32Array;
    var n = new m(buffer);
    var o = global.Float64Array;
    var p = new o(buffer);
    var q = global.byteLength;
    var r = env.DYNAMICTOP_PTR | 0;
    var s = env.tempDoublePtr | 0;
    var t = env.ABORT | 0;
    var u = env.STACKTOP | 0;
    var v = env.STACK_MAX | 0;
    var w = env.cttz_i8 | 0;
    var x = 0;
    var y = 0;
    var z = 0;
    var A = 0;
    var B = global.NaN,
      C = global.Infinity;
    var D = 0,
      E = 0,
      F = 0,
      G = 0,
      H = 0.0;
    var I = 0;
    var J = global.Math.floor;
    var K = global.Math.abs;
    var L = global.Math.sqrt;
    var M = global.Math.pow;
    var N = global.Math.cos;
    var O = global.Math.sin;
    var P = global.Math.tan;
    var Q = global.Math.acos;
    var R = global.Math.asin;
    var S = global.Math.atan;
    var T = global.Math.atan2;
    var U = global.Math.exp;
    var V = global.Math.log;
    var W = global.Math.ceil;
    var X = global.Math.imul;
    var Y = global.Math.min;
    var Z = global.Math.max;
    var _ = global.Math.clz32;
    var $ = global.Math.fround;
    var aa = env.abort;
    var ba = env.assert;
    var ca = env.enlargeMemory;
    var da = env.getTotalMemory;
    var ea = env.abortOnCannotGrowMemory;
    var fa = env.invoke_iiii;
    var ga = env.invoke_viiiii;
    var ha = env.invoke_vi;
    var ia = env.invoke_vii;
    var ja = env.invoke_iiiiiii;
    var ka = env.invoke_ii;
    var la = env.invoke_viii;
    var ma = env.invoke_v;
    var na = env.invoke_viiiiii;
    var oa = env.invoke_iii;
    var pa = env.invoke_viiii;
    var qa = env._pthread_getspecific;
    var ra = env._pthread_setspecific;
    var sa = env.___cxa_throw;
    var ta = env.___gxx_personality_v0;
    var ua = env.___syscall6;
    var va = env.___setErrNo;
    var wa = env._abort;
    var xa = env.___cxa_begin_catch;
    var ya = env._pthread_key_create;
    var za = env.___syscall146;
    var Aa = env._pthread_once;
    var Ba = env._emscripten_memcpy_big;
    var Ca = env.___syscall54;
    var Da = env.___syscall140;
    var Ea = env.___resumeException;
    var Fa = env.___cxa_find_matching_catch;
    var Ga = env.___assert_fail;
    var Ha = env.___cxa_pure_virtual;
    var Ia = env.___cxa_allocate_exception;
    var Ja = env.__ZSt18uncaught_exceptionv;
    var Ka = $(0);
    const La = $(0);
    function Ma(newBuffer) {
      if (
        q(newBuffer) & 16777215 ||
        q(newBuffer) <= 16777215 ||
        q(newBuffer) > 2147483648
      )
        return false;
      b = new a(newBuffer);
      d = new c(newBuffer);
      f = new e(newBuffer);
      h = new g(newBuffer);
      j = new i(newBuffer);
      l = new k(newBuffer);
      n = new m(newBuffer);
      p = new o(newBuffer);
      buffer = newBuffer;
      return true;
    }
    // EMSCRIPTEN_START_FUNCS
    function Oe(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      e = (a + 4) | 0;
      if (!b) {
        c = f[a >> 2] | 0;
        f[a >> 2] = 0;
        if (c | 0) Ns(c);
        f[e >> 2] = 0;
        return;
      }
      if (b >>> 0 > 1073741823) {
        a = Ia(4) | 0;
        ps(a);
        sa(a | 0, 1488, 137);
      }
      n = Xo(b << 2) | 0;
      c = f[a >> 2] | 0;
      f[a >> 2] = n;
      if (c | 0) Ns(c);
      f[e >> 2] = b;
      c = 0;
      do {
        f[((f[a >> 2] | 0) + (c << 2)) >> 2] = 0;
        c = (c + 1) | 0;
      } while ((c | 0) != (b | 0));
      e = (a + 8) | 0;
      h = f[e >> 2] | 0;
      if (!h) return;
      c = f[(h + 4) >> 2] | 0;
      m = (b + -1) | 0;
      n = ((m & b) | 0) == 0;
      if (n) g = c & m;
      else g = ((c >>> 0) % (b >>> 0)) | 0;
      f[((f[a >> 2] | 0) + (g << 2)) >> 2] = e;
      c = f[h >> 2] | 0;
      if (!c) return;
      else {
        i = h;
        e = c;
        c = h;
      }
      a: while (1) {
        b: do
          if (n) {
            l = i;
            j = c;
            while (1) {
              c = e;
              while (1) {
                k = f[(c + 4) >> 2] & m;
                if ((k | 0) == (g | 0)) break;
                e = ((f[a >> 2] | 0) + (k << 2)) | 0;
                if (!(f[e >> 2] | 0)) {
                  h = j;
                  g = k;
                  break b;
                }
                i = (c + 8) | 0;
                h = c;
                while (1) {
                  e = f[h >> 2] | 0;
                  if (!e) break;
                  if ((d[i >> 1] | 0) == (d[(e + 8) >> 1] | 0)) h = e;
                  else break;
                }
                f[j >> 2] = e;
                f[h >> 2] = f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2] = c;
                c = f[l >> 2] | 0;
                if (!c) {
                  c = 34;
                  break a;
                }
              }
              e = f[c >> 2] | 0;
              if (!e) {
                c = 34;
                break a;
              } else {
                l = c;
                j = c;
              }
            }
          } else {
            l = i;
            j = c;
            while (1) {
              c = e;
              while (1) {
                k = (((f[(c + 4) >> 2] | 0) >>> 0) % (b >>> 0)) | 0;
                if ((k | 0) == (g | 0)) break;
                e = ((f[a >> 2] | 0) + (k << 2)) | 0;
                if (!(f[e >> 2] | 0)) {
                  h = j;
                  g = k;
                  break b;
                }
                i = (c + 8) | 0;
                h = c;
                while (1) {
                  e = f[h >> 2] | 0;
                  if (!e) break;
                  if ((d[i >> 1] | 0) == (d[(e + 8) >> 1] | 0)) h = e;
                  else break;
                }
                f[j >> 2] = e;
                f[h >> 2] = f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2] = c;
                c = f[l >> 2] | 0;
                if (!c) {
                  c = 34;
                  break a;
                }
              }
              e = f[c >> 2] | 0;
              if (!e) {
                c = 34;
                break a;
              } else {
                l = c;
                j = c;
              }
            }
          }
        while (0);
        f[e >> 2] = h;
        e = f[c >> 2] | 0;
        if (!e) {
          c = 34;
          break;
        } else i = c;
      }
      if ((c | 0) == 34) return;
    }
    function Pe(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      e = (a + 4) | 0;
      if (!c) {
        d = f[a >> 2] | 0;
        f[a >> 2] = 0;
        if (d | 0) Ns(d);
        f[e >> 2] = 0;
        return;
      }
      if (c >>> 0 > 1073741823) {
        a = Ia(4) | 0;
        ps(a);
        sa(a | 0, 1488, 137);
      }
      n = Xo(c << 2) | 0;
      d = f[a >> 2] | 0;
      f[a >> 2] = n;
      if (d | 0) Ns(d);
      f[e >> 2] = c;
      d = 0;
      do {
        f[((f[a >> 2] | 0) + (d << 2)) >> 2] = 0;
        d = (d + 1) | 0;
      } while ((d | 0) != (c | 0));
      e = (a + 8) | 0;
      h = f[e >> 2] | 0;
      if (!h) return;
      d = f[(h + 4) >> 2] | 0;
      m = (c + -1) | 0;
      n = ((m & c) | 0) == 0;
      if (n) g = d & m;
      else g = ((d >>> 0) % (c >>> 0)) | 0;
      f[((f[a >> 2] | 0) + (g << 2)) >> 2] = e;
      d = f[h >> 2] | 0;
      if (!d) return;
      else {
        i = h;
        e = d;
        d = h;
      }
      a: while (1) {
        b: do
          if (n) {
            l = i;
            j = d;
            while (1) {
              d = e;
              while (1) {
                k = f[(d + 4) >> 2] & m;
                if ((k | 0) == (g | 0)) break;
                e = ((f[a >> 2] | 0) + (k << 2)) | 0;
                if (!(f[e >> 2] | 0)) {
                  h = j;
                  g = k;
                  break b;
                }
                i = (d + 8) | 0;
                h = d;
                while (1) {
                  e = f[h >> 2] | 0;
                  if (!e) break;
                  if ((b[i >> 0] | 0) == (b[(e + 8) >> 0] | 0)) h = e;
                  else break;
                }
                f[j >> 2] = e;
                f[h >> 2] = f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2] = d;
                d = f[l >> 2] | 0;
                if (!d) {
                  d = 34;
                  break a;
                }
              }
              e = f[d >> 2] | 0;
              if (!e) {
                d = 34;
                break a;
              } else {
                l = d;
                j = d;
              }
            }
          } else {
            l = i;
            j = d;
            while (1) {
              d = e;
              while (1) {
                k = (((f[(d + 4) >> 2] | 0) >>> 0) % (c >>> 0)) | 0;
                if ((k | 0) == (g | 0)) break;
                e = ((f[a >> 2] | 0) + (k << 2)) | 0;
                if (!(f[e >> 2] | 0)) {
                  h = j;
                  g = k;
                  break b;
                }
                i = (d + 8) | 0;
                h = d;
                while (1) {
                  e = f[h >> 2] | 0;
                  if (!e) break;
                  if ((b[i >> 0] | 0) == (b[(e + 8) >> 0] | 0)) h = e;
                  else break;
                }
                f[j >> 2] = e;
                f[h >> 2] = f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (k << 2)) >> 2] >> 2] = d;
                d = f[l >> 2] | 0;
                if (!d) {
                  d = 34;
                  break a;
                }
              }
              e = f[d >> 2] | 0;
              if (!e) {
                d = 34;
                break a;
              } else {
                l = d;
                j = d;
              }
            }
          }
        while (0);
        f[e >> 2] = h;
        e = f[d >> 2] | 0;
        if (!e) {
          d = 34;
          break;
        } else i = d;
      }
      if ((d | 0) == 34) return;
    }
    function Qe(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          g = (h[g >> 0] | (h[(g + 1) >> 0] << 8)) << 16 >> 16;
          i = d;
          f[i >> 2] = g;
          f[(i + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            ((h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)) &
              65535) <<
            16 >>
            16;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) << 16 >> 16;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = i;
          i = (i + 4) | 0;
          i =
            lp(
              zp(
                h[j >> 0] |
                  (h[(j + 1) >> 0] << 8) |
                  (h[(j + 2) >> 0] << 16) |
                  (h[(j + 3) >> 0] << 24) |
                  0,
                h[i >> 0] |
                  (h[(i + 1) >> 0] << 8) |
                  (h[(i + 2) >> 0] << 16) |
                  (h[(i + 3) >> 0] << 24) |
                  0,
                48
              ) | 0,
              I | 0,
              48
            ) | 0;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = I;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Re(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      d = (a + 4) | 0;
      if (!b) {
        c = f[a >> 2] | 0;
        f[a >> 2] = 0;
        if (c | 0) Ns(c);
        f[d >> 2] = 0;
        return;
      }
      if (b >>> 0 > 1073741823) {
        a = Ia(4) | 0;
        ps(a);
        sa(a | 0, 1488, 137);
      }
      m = Xo(b << 2) | 0;
      c = f[a >> 2] | 0;
      f[a >> 2] = m;
      if (c | 0) Ns(c);
      f[d >> 2] = b;
      c = 0;
      do {
        f[((f[a >> 2] | 0) + (c << 2)) >> 2] = 0;
        c = (c + 1) | 0;
      } while ((c | 0) != (b | 0));
      d = (a + 8) | 0;
      g = f[d >> 2] | 0;
      if (!g) return;
      c = f[(g + 4) >> 2] | 0;
      l = (b + -1) | 0;
      m = ((l & b) | 0) == 0;
      if (m) e = c & l;
      else e = ((c >>> 0) % (b >>> 0)) | 0;
      f[((f[a >> 2] | 0) + (e << 2)) >> 2] = d;
      c = f[g >> 2] | 0;
      if (!c) return;
      else {
        h = g;
        d = c;
        c = g;
      }
      a: while (1) {
        b: do
          if (m) {
            k = h;
            i = c;
            while (1) {
              c = d;
              while (1) {
                j = f[(c + 4) >> 2] & l;
                if ((j | 0) == (e | 0)) break;
                d = ((f[a >> 2] | 0) + (j << 2)) | 0;
                if (!(f[d >> 2] | 0)) {
                  g = i;
                  e = j;
                  break b;
                }
                h = (c + 8) | 0;
                g = c;
                while (1) {
                  d = f[g >> 2] | 0;
                  if (!d) break;
                  if ((f[h >> 2] | 0) == (f[(d + 8) >> 2] | 0)) g = d;
                  else break;
                }
                f[i >> 2] = d;
                f[g >> 2] = f[f[((f[a >> 2] | 0) + (j << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (j << 2)) >> 2] >> 2] = c;
                c = f[k >> 2] | 0;
                if (!c) {
                  c = 34;
                  break a;
                }
              }
              d = f[c >> 2] | 0;
              if (!d) {
                c = 34;
                break a;
              } else {
                k = c;
                i = c;
              }
            }
          } else {
            k = h;
            i = c;
            while (1) {
              c = d;
              while (1) {
                j = (((f[(c + 4) >> 2] | 0) >>> 0) % (b >>> 0)) | 0;
                if ((j | 0) == (e | 0)) break;
                d = ((f[a >> 2] | 0) + (j << 2)) | 0;
                if (!(f[d >> 2] | 0)) {
                  g = i;
                  e = j;
                  break b;
                }
                h = (c + 8) | 0;
                g = c;
                while (1) {
                  d = f[g >> 2] | 0;
                  if (!d) break;
                  if ((f[h >> 2] | 0) == (f[(d + 8) >> 2] | 0)) g = d;
                  else break;
                }
                f[i >> 2] = d;
                f[g >> 2] = f[f[((f[a >> 2] | 0) + (j << 2)) >> 2] >> 2];
                f[f[((f[a >> 2] | 0) + (j << 2)) >> 2] >> 2] = c;
                c = f[k >> 2] | 0;
                if (!c) {
                  c = 34;
                  break a;
                }
              }
              d = f[c >> 2] | 0;
              if (!d) {
                c = 34;
                break a;
              } else {
                k = c;
                i = c;
              }
            }
          }
        while (0);
        f[d >> 2] = g;
        d = f[c >> 2] | 0;
        if (!d) {
          c = 34;
          break;
        } else h = c;
      }
      if ((c | 0) == 34) return;
    }
    function Se(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = La,
        l = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          g = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[g >> 2] | 0,
                f[(g + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 2, 0) | 0;
          j = I;
          g = f[a >> 2] | 0;
          e = f[g >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? i >>> 0 > (((f[(g + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          l = $((h[j >> 0] | (h[(j + 1) >> 0] << 8)) << 16 >> 16);
          k = $(l / $(32767.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? l : k;
          j = 1;
          return j | 0;
        }
        case 2: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $(
            ((h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
              65535) <<
              16 >>
              16
          );
          l = $(k / $(32767.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $((h[j >> 0] | (h[(j + 1) >> 0] << 8)) << 16 >> 16);
          l = $(k / $(32767.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $(
            ((h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
              65535) <<
              16 >>
              16
          );
          l = $(k / $(32767.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Te(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0;
      v = u;
      u = (u + 32) | 0;
      e = (v + 24) | 0;
      q = (v + 20) | 0;
      t = (v + 8) | 0;
      s = (v + 4) | 0;
      m = v;
      f[e >> 2] = 0;
      _k(e, f[a >> 2] | 0) | 0;
      a: do
        if (f[e >> 2] | 0) {
          d = 0;
          while (1) {
            d = (d + 1) | 0;
            if (!(lf(a, c) | 0)) {
              d = 0;
              break;
            }
            if (d >>> 0 >= (f[e >> 2] | 0) >>> 0) break a;
          }
          u = v;
          return d | 0;
        }
      while (0);
      f[q >> 2] = 0;
      _k(q, f[a >> 2] | 0) | 0;
      b: do
        if (!(f[q >> 2] | 0)) d = 1;
        else {
          i = 0;
          while (1) {
            f[t >> 2] = 0;
            f[(t + 4) >> 2] = 0;
            f[(t + 8) >> 2] = 0;
            g = f[a >> 2] | 0;
            w = (g + 8) | 0;
            x = f[(w + 4) >> 2] | 0;
            h = (g + 16) | 0;
            e = h;
            d = f[e >> 2] | 0;
            e = f[(e + 4) >> 2] | 0;
            if (
              ((x | 0) > (e | 0)) |
                ((x | 0) == (e | 0) ? (f[w >> 2] | 0) >>> 0 > d >>> 0 : 0)
                ? (
                    (l = b[((f[g >> 2] | 0) + d) >> 0] | 0),
                    (j = sq(d | 0, e | 0, 1, 0) | 0),
                    (p = h),
                    (f[p >> 2] = j),
                    (f[(p + 4) >> 2] = I),
                    (p = l & 255),
                    bl(t, p, 0),
                    (j = f[a >> 2] | 0),
                    (o = _m(t, 0) | 0),
                    (g = (j + 8) | 0),
                    (w = f[g >> 2] | 0),
                    (g = f[(g + 4) >> 2] | 0),
                    (r = (j + 16) | 0),
                    (x = r),
                    (k = f[x >> 2] | 0),
                    (l = l & 255),
                    (x = sq(k | 0, f[(x + 4) >> 2] | 0, l | 0, 0) | 0),
                    (h = I),
                    !(
                      ((g | 0) < (h | 0)) |
                      (((g | 0) == (h | 0)) & (w >>> 0 < x >>> 0))
                    )
                  )
                : 0
            ) {
              li(o | 0, ((f[j >> 2] | 0) + k) | 0, p | 0) | 0;
              w = r;
              w = sq(f[w >> 2] | 0, f[(w + 4) >> 2] | 0, l | 0, 0) | 0;
              x = r;
              f[x >> 2] = w;
              f[(x + 4) >> 2] = I;
              x = Xo(40) | 0;
              f[x >> 2] = 0;
              f[(x + 4) >> 2] = 0;
              f[(x + 8) >> 2] = 0;
              f[(x + 12) >> 2] = 0;
              n[(x + 16) >> 2] = $(1.0);
              w = (x + 20) | 0;
              f[w >> 2] = 0;
              f[(w + 4) >> 2] = 0;
              f[(w + 8) >> 2] = 0;
              f[(w + 12) >> 2] = 0;
              n[(x + 36) >> 2] = $(1.0);
              f[s >> 2] = x;
              if (Te(a, x) | 0) {
                d = f[s >> 2] | 0;
                f[s >> 2] = 0;
                f[m >> 2] = d;
                Qh(c, t, m) | 0;
                lk(m);
                d = 0;
              } else d = 1;
              lk(s);
            } else d = 1;
            wq(t);
            i = (i + 1) | 0;
            if (d | 0) {
              d = 0;
              break b;
            }
            if (i >>> 0 >= (f[q >> 2] | 0) >>> 0) {
              d = 1;
              break;
            }
          }
        }
      while (0);
      x = d;
      u = v;
      return x | 0;
    }
    function Ue(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0;
      i = (a + 148) | 0;
      c = f[b >> 2] | 0;
      d = (c | 0) < 0;
      b = (c + 1) | 0;
      do
        if (!d) {
          b = (((b | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : b;
          if (!(((c >>> 0) % 3) | 0)) {
            h = b;
            g = (c + 2) | 0;
            break;
          } else {
            h = b;
            g = (c + -1) | 0;
            break;
          }
        } else {
          h = c;
          g = c;
        }
      while (0);
      switch (f[(a + 168) >> 2] | 0) {
        case 1:
        case 0: {
          if ((h | 0) < 0) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (h << 2)) >> 2] | 0;
          c = f[(a + 156) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 1;
          if ((g | 0) < 0) {
            d = 1;
            b = -1073741824;
            e = 28;
          } else {
            d = 1;
            b = f[((f[f[i >> 2] >> 2] | 0) + (g << 2)) >> 2] | 0;
            e = 28;
          }
          break;
        }
        case 5: {
          if (d) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (c << 2)) >> 2] | 0;
          c = f[(a + 156) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 1;
          if ((h | 0) < 0) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (h << 2)) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 1;
          if ((g | 0) < 0) {
            d = 2;
            b = -1073741824;
            e = 28;
          } else {
            d = 2;
            b = f[((f[f[i >> 2] >> 2] | 0) + (g << 2)) >> 2] | 0;
            e = 28;
          }
          break;
        }
        case 3: {
          if (d) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (c << 2)) >> 2] | 0;
          c = f[(a + 156) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 1;
          if ((h | 0) < 0) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (h << 2)) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 2;
          if ((g | 0) < 0) {
            d = 1;
            b = -1073741824;
            e = 28;
          } else {
            d = 1;
            b = f[((f[f[i >> 2] >> 2] | 0) + (g << 2)) >> 2] | 0;
            e = 28;
          }
          break;
        }
        case 7: {
          if (d) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (c << 2)) >> 2] | 0;
          c = f[(a + 156) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 2;
          if ((h | 0) < 0) b = -1073741824;
          else b = f[((f[f[i >> 2] >> 2] | 0) + (h << 2)) >> 2] | 0;
          e = (c + (b << 2)) | 0;
          f[e >> 2] = (f[e >> 2] | 0) + 2;
          if ((g | 0) < 0) {
            d = 2;
            b = -1073741824;
            e = 28;
          } else {
            d = 2;
            b = f[((f[f[i >> 2] >> 2] | 0) + (g << 2)) >> 2] | 0;
            e = 28;
          }
          break;
        }
        default: {
        }
      }
      if ((e | 0) == 28) {
        g = (c + (b << 2)) | 0;
        f[g >> 2] = (f[g >> 2] | 0) + d;
      }
      if ((h | 0) < 0) b = -1073741824;
      else b = f[((f[f[i >> 2] >> 2] | 0) + (h << 2)) >> 2] | 0;
      b = f[((f[(a + 156) >> 2] | 0) + (b << 2)) >> 2] | 0;
      c = f[(a + 176) >> 2] | 0;
      if ((b | 0) < (c | 0)) {
        i = c;
        i = (i - c) | 0;
        a = (a + 172) | 0;
        f[a >> 2] = i;
        return;
      }
      i = f[(a + 180) >> 2] | 0;
      i = (b | 0) > (i | 0) ? i : b;
      i = (i - c) | 0;
      a = (a + 172) | 0;
      f[a >> 2] = i;
      return;
    }
    function Ve(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = Si((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function We(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = Vi((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function Xe(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = Wi((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function Ye(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = Xi((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function Ze(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = Yi((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function _e(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = _i((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function $e(a, c) {
      a = a | 0;
      c = c | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      e = d[(c + 38) >> 1] | 0;
      if (!(e << 16 >> 16)) {
        a = 0;
        return a | 0;
      }
      t = (a + 12) | 0;
      do
        if ((e & 65535) < 512) {
          o = (c + 8) | 0;
          q = f[o >> 2] | 0;
          o = f[(o + 4) >> 2] | 0;
          g = (c + 16) | 0;
          r = g;
          e = f[r >> 2] | 0;
          r = sq(e | 0, f[(r + 4) >> 2] | 0, 4, 0) | 0;
          p = I;
          if (
            ((o | 0) < (p | 0)) |
            (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0))
          ) {
            a = 0;
            return a | 0;
          } else {
            e = ((f[c >> 2] | 0) + e) | 0;
            e =
              h[e >> 0] |
              (h[(e + 1) >> 0] << 8) |
              (h[(e + 2) >> 0] << 16) |
              (h[(e + 3) >> 0] << 24);
            b[t >> 0] = e;
            b[(t + 1) >> 0] = e >> 8;
            b[(t + 2) >> 0] = e >> 16;
            b[(t + 3) >> 0] = e >> 24;
            q = g;
            q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
            r = g;
            f[r >> 2] = q;
            f[(r + 4) >> 2] = I;
            break;
          }
        } else if (_k(t, c) | 0) {
          e = f[t >> 2] | 0;
          break;
        } else {
          a = 0;
          return a | 0;
        }
      while (0);
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      g = f[a >> 2] | 0;
      k = (i - g) >> 2;
      if (e >>> 0 <= k >>> 0) {
        if (
          e >>> 0 < k >>> 0 ? ((l = (g + (e << 2)) | 0), (i | 0) != (l | 0)) : 0
        )
          f[j >> 2] = i + (~(((i + -4 - l) | 0) >>> 2) << 2);
      } else {
        Tj(a, (e - k) | 0);
        e = f[t >> 2] | 0;
      }
      if (!e) {
        a = 1;
        return a | 0;
      }
      q = (c + 8) | 0;
      r = (c + 16) | 0;
      p = 0;
      a: while (1) {
        n = q;
        m = f[n >> 2] | 0;
        n = f[(n + 4) >> 2] | 0;
        i = r;
        g = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
        if (
          !(((n | 0) > (i | 0)) | (((n | 0) == (i | 0)) & (m >>> 0 > g >>> 0)))
        ) {
          e = 0;
          s = 23;
          break;
        }
        o = f[c >> 2] | 0;
        j = b[(o + g) >> 0] | 0;
        i = sq(g | 0, i | 0, 1, 0) | 0;
        g = I;
        k = r;
        f[k >> 2] = i;
        f[(k + 4) >> 2] = g;
        k = j & 255;
        l = k & 3;
        k = k >>> 2;
        switch (j & 3) {
          case 3: {
            g = (k + p) | 0;
            if (g >>> 0 >= e >>> 0) {
              e = 0;
              s = 23;
              break a;
            }
            Gk(((f[a >> 2] | 0) + (p << 2)) | 0, 0, ((k << 2) + 4) | 0) | 0;
            e = g;
            break;
          }
          case 0: {
            e = k;
            s = 20;
            break;
          }
          default: {
            j = 0;
            e = k;
            while (1) {
              if (
                !(
                  ((n | 0) > (g | 0)) |
                  (((n | 0) == (g | 0)) & (m >>> 0 > i >>> 0))
                )
              ) {
                e = 0;
                s = 23;
                break a;
              }
              s = b[(o + i) >> 0] | 0;
              i = sq(i | 0, g | 0, 1, 0) | 0;
              g = I;
              k = r;
              f[k >> 2] = i;
              f[(k + 4) >> 2] = g;
              e = ((s & 255) << ((j << 3) | 6)) | e;
              j = (j + 1) | 0;
              if ((j | 0) >= (l | 0)) {
                s = 20;
                break;
              }
            }
          }
        }
        if ((s | 0) == 20) {
          s = 0;
          f[((f[a >> 2] | 0) + (p << 2)) >> 2] = e;
          e = p;
        }
        p = (e + 1) | 0;
        e = f[t >> 2] | 0;
        if (p >>> 0 >= e >>> 0) {
          s = 22;
          break;
        }
      }
      if ((s | 0) == 22) {
        a = $i((a + 16) | 0, f[a >> 2] | 0, e) | 0;
        return a | 0;
      } else if ((s | 0) == 23) return e | 0;
      return 0;
    }
    function af(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = La,
        l = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          g = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[g >> 2] | 0,
                f[(g + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 2, 0) | 0;
          j = I;
          g = f[a >> 2] | 0;
          e = f[g >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? i >>> 0 > (((f[(g + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          l = $((h[j >> 0] | (h[(j + 1) >> 0] << 8)) & 65535);
          k = $(l / $(65535.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? l : k;
          j = 1;
          return j | 0;
        }
        case 2: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $(
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
              65535
          );
          l = $(k / $(65535.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $((h[j >> 0] | (h[(j + 1) >> 0] << 8)) & 65535);
          l = $(k / $(65535.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          e = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (e + c) | 0;
          k = $(
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
              65535
          );
          l = $(k / $(65535.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : l;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function bf(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0;
      t = (a + 8) | 0;
      f[t >> 2] = e;
      j = (a + 32) | 0;
      i = (a + 36) | 0;
      h = f[i >> 2] | 0;
      g = f[j >> 2] | 0;
      k = (h - g) >> 2;
      if (k >>> 0 >= e >>> 0)
        if (
          k >>> 0 > e >>> 0 ? ((l = (g + (e << 2)) | 0), (h | 0) != (l | 0)) : 0
        ) {
          f[i >> 2] = h + (~(((h + -4 - l) | 0) >>> 2) << 2);
          g = e;
        } else g = e;
      else {
        Tj(j, (e - k) | 0);
        g = f[t >> 2] | 0;
      }
      r = e >>> 0 > 1073741823 ? -1 : e << 2;
      s = Ks(r) | 0;
      Gk(s | 0, 0, r | 0) | 0;
      if ((g | 0) > 0) {
        l = (a + 16) | 0;
        i = (a + 32) | 0;
        m = (a + 12) | 0;
        j = 0;
        do {
          g = f[(s + (j << 2)) >> 2] | 0;
          h = f[l >> 2] | 0;
          if ((g | 0) > (h | 0)) {
            k = f[i >> 2] | 0;
            f[(k + (j << 2)) >> 2] = h;
          } else {
            r = f[m >> 2] | 0;
            k = f[i >> 2] | 0;
            f[(k + (j << 2)) >> 2] = (g | 0) < (r | 0) ? r : g;
          }
          j = (j + 1) | 0;
          g = f[t >> 2] | 0;
        } while ((j | 0) < (g | 0));
        if ((g | 0) > 0) {
          j = (a + 20) | 0;
          i = 0;
          do {
            g =
              ((f[(b + (i << 2)) >> 2] | 0) + (f[(k + (i << 2)) >> 2] | 0)) | 0;
            h = (c + (i << 2)) | 0;
            f[h >> 2] = g;
            if ((g | 0) <= (f[l >> 2] | 0)) {
              if ((g | 0) < (f[m >> 2] | 0)) {
                g = ((f[j >> 2] | 0) + g) | 0;
                u = 18;
              }
            } else {
              g = (g - (f[j >> 2] | 0)) | 0;
              u = 18;
            }
            if ((u | 0) == 18) {
              u = 0;
              f[h >> 2] = g;
            }
            i = (i + 1) | 0;
            g = f[t >> 2] | 0;
          } while ((i | 0) < (g | 0));
        }
      }
      if ((e | 0) >= (d | 0)) {
        Ls(s);
        return 1;
      }
      p = (0 - e) | 0;
      q = (a + 16) | 0;
      o = (a + 32) | 0;
      r = (a + 12) | 0;
      n = (a + 20) | 0;
      a = e;
      do {
        l = (c + (a << 2)) | 0;
        j = (l + (p << 2)) | 0;
        m = (b + (a << 2)) | 0;
        if ((g | 0) > 0) {
          i = 0;
          do {
            g = f[(j + (i << 2)) >> 2] | 0;
            h = f[q >> 2] | 0;
            if ((g | 0) > (h | 0)) {
              k = f[o >> 2] | 0;
              f[(k + (i << 2)) >> 2] = h;
            } else {
              h = f[r >> 2] | 0;
              k = f[o >> 2] | 0;
              f[(k + (i << 2)) >> 2] = (g | 0) < (h | 0) ? h : g;
            }
            i = (i + 1) | 0;
            g = f[t >> 2] | 0;
          } while ((i | 0) < (g | 0));
          if ((g | 0) > 0) {
            i = 0;
            do {
              g =
                ((f[(m + (i << 2)) >> 2] | 0) + (f[(k + (i << 2)) >> 2] | 0)) |
                0;
              h = (l + (i << 2)) | 0;
              f[h >> 2] = g;
              if ((g | 0) <= (f[q >> 2] | 0)) {
                if ((g | 0) < (f[r >> 2] | 0)) {
                  g = ((f[n >> 2] | 0) + g) | 0;
                  u = 33;
                }
              } else {
                g = (g - (f[n >> 2] | 0)) | 0;
                u = 33;
              }
              if ((u | 0) == 33) {
                u = 0;
                f[h >> 2] = g;
              }
              i = (i + 1) | 0;
              g = f[t >> 2] | 0;
            } while ((i | 0) < (g | 0));
          }
        }
        a = (a + e) | 0;
      } while ((a | 0) < (d | 0));
      Ls(s);
      return 1;
    }
    function cf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 65535;
          f[(d + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j & 65535;
          f[(d + 4) >> 2] = j >>> 16;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = (i + 2) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 65535;
          f[(d + 4) >> 2] = j & 65535;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          i = j;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = (j + 4) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = i & 65535;
          j = Ep(i | 0, j | 0, 16) | 0;
          f[(d + 4) >> 2] = j & 65535;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function df(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = (c + 8) | 0;
      j = f[(i + 4) >> 2] | 0;
      h = (c + 16) | 0;
      e = h;
      g = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      if (
        !(
          ((j | 0) > (e | 0)) |
          ((j | 0) == (e | 0) ? (f[i >> 2] | 0) >>> 0 > g >>> 0 : 0)
        )
      ) {
        j = 0;
        return j | 0;
      }
      j = b[((f[c >> 2] | 0) + g) >> 0] | 0;
      g = sq(g | 0, e | 0, 1, 0) | 0;
      i = h;
      f[i >> 2] = g;
      f[(i + 4) >> 2] = I;
      do
        switch (j << 24 >> 24) {
          case 1: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 2: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 3: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 4: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 5: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 6: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 7: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 8: {
            j = _g(a, c, d) | 0;
            return j | 0;
          }
          case 9: {
            j = Zg(a, c, d) | 0;
            return j | 0;
          }
          case 10: {
            j = Xg(a, c, d) | 0;
            return j | 0;
          }
          case 11: {
            j = Wg(a, c, d) | 0;
            return j | 0;
          }
          case 12: {
            j = Vg(a, c, d) | 0;
            return j | 0;
          }
          case 13: {
            j = Ug(a, c, d) | 0;
            return j | 0;
          }
          case 14: {
            j = Tg(a, c, d) | 0;
            return j | 0;
          }
          case 15: {
            j = Tg(a, c, d) | 0;
            return j | 0;
          }
          case 16: {
            j = Tg(a, c, d) | 0;
            return j | 0;
          }
          case 17: {
            j = Tg(a, c, d) | 0;
            return j | 0;
          }
          case 18: {
            j = Tg(a, c, d) | 0;
            return j | 0;
          }
          default: {
            j = 0;
            return j | 0;
          }
        }
      while (0);
      return 0;
    }
    function ef(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = d;
          f[i >> 2] = g;
          f[(i + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            lp(
              0,
              h[i >> 0] |
                (h[(i + 1) >> 0] << 8) |
                (h[(i + 2) >> 0] << 16) |
                (h[(i + 3) >> 0] << 24) |
                0,
              32
            ) | 0;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = I;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function ff(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0;
      f[a >> 2] = 4580;
      d = (a + 376) | 0;
      c = f[d >> 2] | 0;
      f[d >> 2] = 0;
      if (c | 0) {
        d = (c + -4) | 0;
        b = f[d >> 2] | 0;
        if (b | 0) {
          b = (c + (b << 4)) | 0;
          do {
            b = (b + -16) | 0;
            Ss(b);
          } while ((b | 0) != (c | 0));
        }
        Ls(d);
      }
      Ss((a + 360) | 0);
      Ss((a + 320) | 0);
      Ss((a + 304) | 0);
      Ss((a + 264) | 0);
      ak((a + 224) | 0);
      b = f[(a + 208) >> 2] | 0;
      if (b | 0) {
        d = (a + 212) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 196) >> 2] | 0;
      if (b | 0) {
        d = (a + 200) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 184) >> 2] | 0;
      if (b | 0) {
        d = (a + 188) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 172) >> 2] | 0;
      if (b | 0) {
        d = (a + 176) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 156) >> 2] | 0;
      if (b | 0)
        do {
          d = b;
          b = f[b >> 2] | 0;
          Ns(d);
        } while ((b | 0) != 0);
      d = (a + 148) | 0;
      b = f[d >> 2] | 0;
      f[d >> 2] = 0;
      if (b | 0) Ns(b);
      b = f[(a + 132) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 120) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 108) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 84) >> 2] | 0;
      if (b | 0) {
        d = (a + 88) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 72) >> 2] | 0;
      if (b | 0) {
        d = (a + 76) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 60) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 48) >> 2] | 0;
      if (b | 0) {
        d = (a + 52) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 36) >> 2] | 0;
      if (b | 0) {
        d = (a + 40) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] =
            c + ((~(((((c + -12 - b) | 0) >>> 0) / 12) | 0) * 12) | 0);
        Ns(b);
      }
      b = f[(a + 24) >> 2] | 0;
      if (b | 0) {
        d = (a + 28) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 12) >> 2] | 0;
      if (b | 0) {
        d = (a + 16) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      a = (a + 8) | 0;
      b = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (!b) return;
      Vk(b);
      Ns(b);
      return;
    }
    function gf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = b[(c + e) >> 0];
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = (j & 65535) << 24 >> 24;
          f[(d + 4) >> 2] = (((j & 65535) >>> 8) & 65535) << 24 >> 24;
          j = (d + 8) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          g = (c + e) | 0;
          i = b[(g + 1) >> 0] | 0;
          j = b[(g + 2) >> 0] | 0;
          f[d >> 2] = b[g >> 0];
          f[(d + 4) >> 2] = i << 24 >> 24;
          f[(d + 8) >> 2] = j << 24 >> 24;
          f[(d + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j << 24 >> 24;
          f[(d + 4) >> 2] = j << 16 >> 24;
          f[(d + 8) >> 2] = j << 8 >> 24;
          f[(d + 12) >> 2] = j >> 24;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function hf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          i = d;
          f[i >> 2] = h[(c + e) >> 0];
          f[(i + 4) >> 2] = 0;
          i = (d + 8) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i = h[i >> 0] | (h[(i + 1) >> 0] << 8);
          j = d;
          f[j >> 2] = i & 255;
          f[(j + 4) >> 2] = 0;
          j = (d + 8) | 0;
          f[j >> 2] = ((i & 65535) >>> 8) & 65535;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          g = (c + e) | 0;
          i = b[(g + 1) >> 0] | 0;
          j = d;
          f[j >> 2] = h[g >> 0];
          f[(j + 4) >> 2] = 0;
          j = (d + 8) | 0;
          f[j >> 2] = i & 255;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] = i & 255;
          f[(j + 4) >> 2] = 0;
          j = (d + 8) | 0;
          f[j >> 2] = (i >>> 8) & 255;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function jf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          a = g;
          g = (g + 4) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = d;
          f[i >> 2] =
            h[a >> 0] |
            (h[(a + 1) >> 0] << 8) |
            (h[(a + 2) >> 0] << 16) |
            (h[(a + 3) >> 0] << 24);
          f[(i + 4) >> 2] = g;
          i = (d + 8) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          f[(i + 12) >> 2] = 0;
          f[(i + 16) >> 2] = 0;
          f[(i + 20) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 16, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = (d + 16) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          f[(j + 8) >> 2] = 0;
          f[(j + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 24, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 24) | 0;
          j = (d + 24) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 32, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 32) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function kf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = h[(c + e) >> 0];
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = ((j & 65535) >>> 8) & 65535;
          j = (d + 8) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          g = (c + e) | 0;
          i = b[(g + 1) >> 0] | 0;
          j = b[(g + 2) >> 0] | 0;
          f[d >> 2] = h[g >> 0];
          f[(d + 4) >> 2] = i & 255;
          f[(d + 8) >> 2] = j & 255;
          f[(d + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = (j >>> 8) & 255;
          f[(d + 8) >> 2] = (j >>> 16) & 255;
          f[(d + 12) >> 2] = j >>> 24;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function lf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      n = u;
      u = (u + 32) | 0;
      m = (n + 16) | 0;
      k = (n + 12) | 0;
      l = n;
      f[m >> 2] = 0;
      f[(m + 4) >> 2] = 0;
      f[(m + 8) >> 2] = 0;
      d = f[a >> 2] | 0;
      j = (d + 8) | 0;
      i = f[(j + 4) >> 2] | 0;
      h = (d + 16) | 0;
      e = h;
      g = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      if (
        !(
          ((i | 0) > (e | 0)) |
          ((i | 0) == (e | 0) ? (f[j >> 2] | 0) >>> 0 > g >>> 0 : 0)
        )
      ) {
        l = 0;
        wq(m);
        u = n;
        return l | 0;
      }
      q = b[((f[d >> 2] | 0) + g) >> 0] | 0;
      d = sq(g | 0, e | 0, 1, 0) | 0;
      i = h;
      f[i >> 2] = d;
      f[(i + 4) >> 2] = I;
      i = q & 255;
      bl(m, i, 0);
      d = f[a >> 2] | 0;
      h = _m(m, 0) | 0;
      r = (d + 8) | 0;
      p = f[r >> 2] | 0;
      r = f[(r + 4) >> 2] | 0;
      j = (d + 16) | 0;
      o = j;
      e = f[o >> 2] | 0;
      g = q & 255;
      o = sq(e | 0, f[(o + 4) >> 2] | 0, g | 0, 0) | 0;
      q = I;
      if (((r | 0) < (q | 0)) | (((r | 0) == (q | 0)) & (p >>> 0 < o >>> 0))) {
        r = 0;
        wq(m);
        u = n;
        return r | 0;
      }
      li(h | 0, ((f[d >> 2] | 0) + e) | 0, i | 0) | 0;
      i = j;
      i = sq(f[i >> 2] | 0, f[(i + 4) >> 2] | 0, g | 0, 0) | 0;
      d = j;
      f[d >> 2] = i;
      f[(d + 4) >> 2] = I;
      f[k >> 2] = 0;
      _k(k, f[a >> 2] | 0) | 0;
      d = f[k >> 2] | 0;
      f[l >> 2] = 0;
      i = (l + 4) | 0;
      f[i >> 2] = 0;
      f[(l + 8) >> 2] = 0;
      if (!d) h = 0;
      else {
        if ((d | 0) < 0) xr(l);
        e = Xo(d) | 0;
        f[i >> 2] = e;
        f[l >> 2] = e;
        f[(l + 8) >> 2] = e + d;
        do {
          b[e >> 0] = 0;
          e = ((f[i >> 2] | 0) + 1) | 0;
          f[i >> 2] = e;
          d = (d + -1) | 0;
        } while ((d | 0) != 0);
        h = f[k >> 2] | 0;
      }
      d = f[a >> 2] | 0;
      o = (d + 8) | 0;
      q = f[o >> 2] | 0;
      o = f[(o + 4) >> 2] | 0;
      g = (d + 16) | 0;
      r = g;
      e = f[r >> 2] | 0;
      r = sq(e | 0, f[(r + 4) >> 2] | 0, h | 0, 0) | 0;
      p = I;
      if (((o | 0) < (p | 0)) | (((o | 0) == (p | 0)) & (q >>> 0 < r >>> 0)))
        e = 0;
      else {
        li(f[l >> 2] | 0, ((f[d >> 2] | 0) + e) | 0, h | 0) | 0;
        r = g;
        r = sq(f[r >> 2] | 0, f[(r + 4) >> 2] | 0, h | 0, 0) | 0;
        e = g;
        f[e >> 2] = r;
        f[(e + 4) >> 2] = I;
        so(c, m, l);
        e = 1;
      }
      d = f[l >> 2] | 0;
      if (d | 0) {
        if ((f[i >> 2] | 0) != (d | 0)) f[i >> 2] = d;
        Ns(d);
      }
      r = e;
      wq(m);
      u = n;
      return r | 0;
    }
    function mf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = La,
        k = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          j = $(((b[(c + e) >> 0] | 0) != 0) & 1);
          n[d >> 2] = j;
          n[(d + 4) >> 2] = $(0.0);
          i = 1;
          return i | 0;
        }
        case 2: {
          k = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                k | 0,
                (((k | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          k = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((k | 0) > 0) |
            ((k | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (c + e) | 0;
          k = h[k >> 0] | (h[(k + 1) >> 0] << 8);
          j = $(((k & 255) << 24 >> 24 != 0) & 1);
          n[d >> 2] = j;
          j = $(((k & 65535) > 255) & 1);
          n[(d + 4) >> 2] = j;
          k = 1;
          return k | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          k = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          k = f[a >> 2] | 0;
          c = f[k >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(k + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          i = (c + e) | 0;
          k = b[(i + 1) >> 0] | 0;
          j = $(((b[i >> 0] | 0) != 0) & 1);
          n[d >> 2] = j;
          j = $((k << 24 >> 24 != 0) & 1);
          n[(d + 4) >> 2] = j;
          k = 1;
          return k | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          k = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          k = f[a >> 2] | 0;
          c = f[k >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(k + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (c + e) | 0;
          k =
            h[k >> 0] |
            (h[(k + 1) >> 0] << 8) |
            (h[(k + 2) >> 0] << 16) |
            (h[(k + 3) >> 0] << 24);
          j = $(((k & 255) << 24 >> 24 != 0) & 1);
          n[d >> 2] = j;
          j = $((((k & 65280) | 0) != 0) & 1);
          n[(d + 4) >> 2] = j;
          k = 1;
          return k | 0;
        }
        default: {
          k = 0;
          return k | 0;
        }
      }
      return 0;
    }
    function nf(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0;
      y = u;
      u = (u + 16) | 0;
      x = (y + 4) | 0;
      w = y;
      f[(a + 72) >> 2] = e;
      f[(a + 64) >> 2] = g;
      t = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      v = (a + 68) | 0;
      d = f[v >> 2] | 0;
      f[v >> 2] = t;
      if (d | 0) Ls(d);
      t = (a + 8) | 0;
      f[t >> 2] = e;
      i = (a + 32) | 0;
      h = (a + 36) | 0;
      g = f[h >> 2] | 0;
      d = f[i >> 2] | 0;
      j = (g - d) >> 2;
      if (j >>> 0 >= e >>> 0) {
        if (
          j >>> 0 > e >>> 0 ? ((k = (d + (e << 2)) | 0), (g | 0) != (k | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - k) | 0) >>> 2) << 2);
      } else Tj(i, (e - j) | 0);
      o = (a + 56) | 0;
      h = f[o >> 2] | 0;
      g = f[(h + 4) >> 2] | 0;
      d = f[h >> 2] | 0;
      r = (g - d) | 0;
      s = r >> 2;
      if ((r | 0) <= 0) {
        u = y;
        return 1;
      }
      q = (a + 16) | 0;
      n = (a + 32) | 0;
      r = (a + 12) | 0;
      p = (a + 20) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((g - d) >> 2 >>> 0 <= h >>> 0) {
          wr(i);
          d = f[i >> 2] | 0;
        }
        f[w >> 2] = f[(d + (h << 2)) >> 2];
        f[x >> 2] = f[w >> 2];
        Kc(a, x, c, h);
        m = X(h, e) | 0;
        i = f[v >> 2] | 0;
        l = (b + (m << 2)) | 0;
        m = (c + (m << 2)) | 0;
        if ((f[t >> 2] | 0) > 0) {
          j = 0;
          do {
            d = f[(i + (j << 2)) >> 2] | 0;
            g = f[q >> 2] | 0;
            if ((d | 0) > (g | 0)) {
              k = f[n >> 2] | 0;
              f[(k + (j << 2)) >> 2] = g;
            } else {
              g = f[r >> 2] | 0;
              k = f[n >> 2] | 0;
              f[(k + (j << 2)) >> 2] = (d | 0) < (g | 0) ? g : d;
            }
            j = (j + 1) | 0;
            d = f[t >> 2] | 0;
          } while ((j | 0) < (d | 0));
          if ((d | 0) > 0) {
            i = 0;
            do {
              d =
                ((f[(l + (i << 2)) >> 2] | 0) + (f[(k + (i << 2)) >> 2] | 0)) |
                0;
              g = (m + (i << 2)) | 0;
              f[g >> 2] = d;
              if ((d | 0) <= (f[q >> 2] | 0)) {
                if ((d | 0) < (f[r >> 2] | 0)) {
                  d = ((f[p >> 2] | 0) + d) | 0;
                  z = 24;
                }
              } else {
                d = (d - (f[p >> 2] | 0)) | 0;
                z = 24;
              }
              if ((z | 0) == 24) {
                z = 0;
                f[g >> 2] = d;
              }
              i = (i + 1) | 0;
            } while ((i | 0) < (f[t >> 2] | 0));
          }
        }
        h = (h + 1) | 0;
        if ((h | 0) >= (s | 0)) break;
        i = f[o >> 2] | 0;
        d = f[i >> 2] | 0;
        g = f[(i + 4) >> 2] | 0;
      }
      u = y;
      return 1;
    }
    function of(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = La,
        k = La,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          e = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[e >> 2] | 0,
                f[(e + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = I;
          g = f[a >> 2] | 0;
          e = f[g >> 2] | 0;
          if (
            !(
              ((i | 0) < 0) |
              ((i | 0) == 0
                ? c >>> 0 < (((f[(g + 4) >> 2] | 0) - e) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          k = $(b[(e + c) >> 0] | 0);
          j = $(k / $(127.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : j;
          i = 1;
          return i | 0;
        }
        case 2: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          g = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          i = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              c | 0
            ) | 0;
          g = sq(c | 0, I | 0, 2, 0) | 0;
          l = I;
          i = f[a >> 2] | 0;
          e = f[i >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (e + c) | 0;
          j = $(((h[l >> 0] | (h[(l + 1) >> 0] << 8)) & 255) << 24 >> 24);
          k = $(j / $(127.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 3, 0) | 0;
          g = I;
          l = f[a >> 2] | 0;
          e = f[l >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(l + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          j = $(b[(e + c) >> 0] | 0);
          k = $(j / $(127.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 4, 0) | 0;
          g = I;
          l = f[a >> 2] | 0;
          e = f[l >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(l + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (e + c) | 0;
          j = $(
            ((h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) &
              255) <<
              24 >>
              24
          );
          k = $(j / $(127.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function pf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          g = i;
          i = (i + 4) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          f[(j + 4) >> 2] = i;
          j = (d + 8) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          n[(d + 12) >> 2] = $(0.0);
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function qf(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0;
      y = u;
      u = (u + 16) | 0;
      x = (y + 4) | 0;
      w = y;
      f[(a + 72) >> 2] = e;
      f[(a + 64) >> 2] = g;
      t = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      v = (a + 68) | 0;
      d = f[v >> 2] | 0;
      f[v >> 2] = t;
      if (d | 0) Ls(d);
      t = (a + 8) | 0;
      f[t >> 2] = e;
      i = (a + 32) | 0;
      h = (a + 36) | 0;
      g = f[h >> 2] | 0;
      d = f[i >> 2] | 0;
      j = (g - d) >> 2;
      if (j >>> 0 >= e >>> 0) {
        if (
          j >>> 0 > e >>> 0 ? ((k = (d + (e << 2)) | 0), (g | 0) != (k | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - k) | 0) >>> 2) << 2);
      } else Tj(i, (e - j) | 0);
      o = (a + 56) | 0;
      h = f[o >> 2] | 0;
      g = f[(h + 4) >> 2] | 0;
      d = f[h >> 2] | 0;
      r = (g - d) | 0;
      s = r >> 2;
      if ((r | 0) <= 0) {
        u = y;
        return 1;
      }
      q = (a + 16) | 0;
      n = (a + 32) | 0;
      r = (a + 12) | 0;
      p = (a + 20) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((g - d) >> 2 >>> 0 <= h >>> 0) {
          wr(i);
          d = f[i >> 2] | 0;
        }
        f[w >> 2] = f[(d + (h << 2)) >> 2];
        f[x >> 2] = f[w >> 2];
        Hc(a, x, c, h);
        m = X(h, e) | 0;
        i = f[v >> 2] | 0;
        l = (b + (m << 2)) | 0;
        m = (c + (m << 2)) | 0;
        if ((f[t >> 2] | 0) > 0) {
          j = 0;
          do {
            d = f[(i + (j << 2)) >> 2] | 0;
            g = f[q >> 2] | 0;
            if ((d | 0) > (g | 0)) {
              k = f[n >> 2] | 0;
              f[(k + (j << 2)) >> 2] = g;
            } else {
              g = f[r >> 2] | 0;
              k = f[n >> 2] | 0;
              f[(k + (j << 2)) >> 2] = (d | 0) < (g | 0) ? g : d;
            }
            j = (j + 1) | 0;
            d = f[t >> 2] | 0;
          } while ((j | 0) < (d | 0));
          if ((d | 0) > 0) {
            i = 0;
            do {
              d =
                ((f[(l + (i << 2)) >> 2] | 0) + (f[(k + (i << 2)) >> 2] | 0)) |
                0;
              g = (m + (i << 2)) | 0;
              f[g >> 2] = d;
              if ((d | 0) <= (f[q >> 2] | 0)) {
                if ((d | 0) < (f[r >> 2] | 0)) {
                  d = ((f[p >> 2] | 0) + d) | 0;
                  z = 24;
                }
              } else {
                d = (d - (f[p >> 2] | 0)) | 0;
                z = 24;
              }
              if ((z | 0) == 24) {
                z = 0;
                f[g >> 2] = d;
              }
              i = (i + 1) | 0;
            } while ((i | 0) < (f[t >> 2] | 0));
          }
        }
        h = (h + 1) | 0;
        if ((h | 0) >= (s | 0)) break;
        i = f[o >> 2] | 0;
        d = f[i >> 2] | 0;
        g = f[(i + 4) >> 2] | 0;
      }
      u = y;
      return 1;
    }
    function rf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          g = i;
          i = (i + 4) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          f[(j + 4) >> 2] = i;
          j = (d + 8) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          f[(d + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function sf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = La,
        k = La,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          e = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[e >> 2] | 0,
                f[(e + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = I;
          g = f[a >> 2] | 0;
          e = f[g >> 2] | 0;
          if (
            !(
              ((i | 0) < 0) |
              ((i | 0) == 0
                ? c >>> 0 < (((f[(g + 4) >> 2] | 0) - e) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          k = $(h[(e + c) >> 0] | 0);
          j = $(k / $(255.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? k : j;
          i = 1;
          return i | 0;
        }
        case 2: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          g = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          i = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              c | 0
            ) | 0;
          g = sq(c | 0, I | 0, 2, 0) | 0;
          l = I;
          i = f[a >> 2] | 0;
          e = f[i >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (e + c) | 0;
          j = $((h[l >> 0] | (h[(l + 1) >> 0] << 8)) & 255);
          k = $(j / $(255.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 3, 0) | 0;
          g = I;
          l = f[a >> 2] | 0;
          e = f[l >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(l + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          j = $(h[(e + c) >> 0] | 0);
          k = $(j / $(255.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          c = (a + 48) | 0;
          i = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              c | 0
            ) | 0;
          i = sq(c | 0, I | 0, 4, 0) | 0;
          g = I;
          l = f[a >> 2] | 0;
          e = f[l >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(l + 4) >> 2] | 0) - e) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (e + c) | 0;
          j = $(
            (h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) &
              255
          );
          k = $(j / $(255.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? j : k;
          l = 1;
          return l | 0;
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function tf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) << 16 >> 16;
          f[(d + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j << 16 >> 16;
          f[(d + 4) >> 2] = j >> 16;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = (i + 2) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) << 16 >> 16;
          f[(d + 4) >> 2] = j << 16 >> 16;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j << 16 >> 16;
          f[(d + 4) >> 2] = j >> 16;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function uf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      k = (a + 8) | 0;
      e = f[k >> 2] | 0;
      switch (f[(e + 28) >> 2] | 0) {
        case 2: {
          d = b[(e + 24) >> 0] | 0;
          j = d << 24 >> 24;
          i = Ks((j | 0) > -1 ? j : -1) | 0;
          h = f[(a + 16) >> 2] | 0;
          h = ((f[f[h >> 2] >> 2] | 0) + (f[(h + 48) >> 2] | 0)) | 0;
          a: do
            if (c | 0) {
              if (d << 24 >> 24 > 0) {
                a = 0;
                e = 0;
              } else {
                li(f[f[(e + 64) >> 2] >> 2] | 0, i | 0, j | 0) | 0;
                if ((c | 0) == 1) break;
                else {
                  d = 1;
                  a = 0;
                }
                while (1) {
                  a = (a + j) | 0;
                  li(
                    ((f[f[((f[k >> 2] | 0) + 64) >> 2] >> 2] | 0) + a) | 0,
                    i | 0,
                    j | 0
                  ) | 0;
                  d = (d + 1) | 0;
                  if ((d | 0) == (c | 0)) break a;
                }
              }
              while (1) {
                d = 0;
                g = e;
                while (1) {
                  b[(i + d) >> 0] = f[(h + (g << 2)) >> 2];
                  d = (d + 1) | 0;
                  if ((d | 0) == (j | 0)) break;
                  else g = (g + 1) | 0;
                }
                li(
                  ((f[f[((f[k >> 2] | 0) + 64) >> 2] >> 2] | 0) + e) | 0,
                  i | 0,
                  j | 0
                ) | 0;
                a = (a + 1) | 0;
                if ((a | 0) == (c | 0)) break;
                else e = (e + j) | 0;
              }
            }
          while (0);
          Ls(i);
          c = 1;
          return c | 0;
        }
        case 1: {
          d = b[(e + 24) >> 0] | 0;
          j = d << 24 >> 24;
          i = Ks((j | 0) > -1 ? j : -1) | 0;
          h = f[(a + 16) >> 2] | 0;
          h = ((f[f[h >> 2] >> 2] | 0) + (f[(h + 48) >> 2] | 0)) | 0;
          b: do
            if (c | 0) {
              if (d << 24 >> 24 > 0) {
                a = 0;
                e = 0;
              } else {
                li(f[f[(e + 64) >> 2] >> 2] | 0, i | 0, j | 0) | 0;
                if ((c | 0) == 1) break;
                else {
                  d = 1;
                  a = 0;
                }
                while (1) {
                  a = (a + j) | 0;
                  li(
                    ((f[f[((f[k >> 2] | 0) + 64) >> 2] >> 2] | 0) + a) | 0,
                    i | 0,
                    j | 0
                  ) | 0;
                  d = (d + 1) | 0;
                  if ((d | 0) == (c | 0)) break b;
                }
              }
              while (1) {
                d = 0;
                g = e;
                while (1) {
                  b[(i + d) >> 0] = f[(h + (g << 2)) >> 2];
                  d = (d + 1) | 0;
                  if ((d | 0) == (j | 0)) break;
                  else g = (g + 1) | 0;
                }
                li(
                  ((f[f[((f[k >> 2] | 0) + 64) >> 2] >> 2] | 0) + e) | 0,
                  i | 0,
                  j | 0
                ) | 0;
                a = (a + 1) | 0;
                if ((a | 0) == (c | 0)) break;
                else e = (e + j) | 0;
              }
            }
          while (0);
          Ls(i);
          c = 1;
          return c | 0;
        }
        case 4: {
          Dj(a, c);
          c = 1;
          return c | 0;
        }
        case 3: {
          Dj(a, c);
          c = 1;
          return c | 0;
        }
        case 6: {
          Ej(a, c);
          c = 1;
          return c | 0;
        }
        case 5: {
          Ej(a, c);
          c = 1;
          return c | 0;
        }
        default: {
          c = 0;
          return c | 0;
        }
      }
      return 0;
    }
    function vf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = b[(c + e) >> 0];
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = (j & 65535) << 24 >> 24;
          f[(d + 4) >> 2] = (((j & 65535) >>> 8) & 65535) << 24 >> 24;
          f[(d + 8) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          g = (c + e) | 0;
          i = b[(g + 1) >> 0] | 0;
          j = b[(g + 2) >> 0] | 0;
          f[d >> 2] = b[g >> 0];
          f[(d + 4) >> 2] = i << 24 >> 24;
          f[(d + 8) >> 2] = j << 24 >> 24;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j << 24 >> 24;
          f[(d + 4) >> 2] = j << 16 >> 24;
          f[(d + 8) >> 2] = j << 8 >> 24;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function wf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          i = d;
          f[i >> 2] =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function xf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = h[(c + e) >> 0];
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = ((j & 65535) >>> 8) & 65535;
          f[(d + 8) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          g = (c + e) | 0;
          i = b[(g + 1) >> 0] | 0;
          j = b[(g + 2) >> 0] | 0;
          f[d >> 2] = h[g >> 0];
          f[(d + 4) >> 2] = i & 255;
          f[(d + 8) >> 2] = j & 255;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = (j >>> 8) & 255;
          f[(d + 8) >> 2] = (j >>> 16) & 255;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function yf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          g = i;
          i = (i + 4) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          f[(j + 4) >> 2] = i;
          n[(d + 8) >> 2] = $(0.0);
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function zf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          i = d;
          f[i >> 2] = (h[g >> 0] | (h[(g + 1) >> 0] << 8)) & 65535;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            (h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)) &
            65535;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 65535;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            (h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)) &
            65535;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Af(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          a = g;
          g = (g + 4) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = d;
          f[i >> 2] =
            h[a >> 0] |
            (h[(a + 1) >> 0] << 8) |
            (h[(a + 2) >> 0] << 16) |
            (h[(a + 3) >> 0] << 24);
          f[(i + 4) >> 2] = g;
          i = (d + 8) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          f[(i + 12) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 16, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = (d + 16) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 24, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 24) | 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 32, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 24) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Bf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          g = i;
          i = (i + 4) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          f[(j + 4) >> 2] = i;
          f[(d + 8) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 12) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Cf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          g = b[(c + e) >> 0] | 0;
          i = d;
          f[i >> 2] = g;
          f[(i + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i = ((h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 255) << 24 >> 24;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = b[(c + e) >> 0] | 0;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          i =
            ((h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)) &
              255) <<
            24 >>
            24;
          j = d;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Df(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = f[b >> 2] | 0;
      k = f[(b + 4) >> 2] | 0;
      n = ((((f[c >> 2] | 0) - p) << 3) + (f[(c + 4) >> 2] | 0) - k) | 0;
      c = p;
      if ((n | 0) <= 0) {
        b = (d + 4) | 0;
        d = f[d >> 2] | 0;
        f[a >> 2] = d;
        a = (a + 4) | 0;
        d = f[b >> 2] | 0;
        f[a >> 2] = d;
        return;
      }
      if (!k) {
        l = (d + 4) | 0;
        e = f[l >> 2] | 0;
        g = n;
      } else {
        i = (32 - k) | 0;
        m = (n | 0) < (i | 0) ? n : i;
        i = (-1 >>> ((i - m) | 0)) & (-1 << k) & f[c >> 2];
        l = (d + 4) | 0;
        e = f[l >> 2] | 0;
        j = (32 - e) | 0;
        g = j >>> 0 < m >>> 0 ? j : m;
        h = f[d >> 2] | 0;
        e = f[h >> 2] & ~((-1 >>> ((j - g) | 0)) & (-1 << e));
        f[h >> 2] = e;
        j = f[l >> 2] | 0;
        f[h >> 2] =
          (j >>> 0 > k >>> 0 ? i << (j - k) : i >>> ((k - j) | 0)) | e;
        e = ((f[l >> 2] | 0) + g) | 0;
        h = (h + (e >>> 5 << 2)) | 0;
        f[d >> 2] = h;
        e = e & 31;
        f[l >> 2] = e;
        j = (m - g) | 0;
        if ((j | 0) > 0) {
          f[h >> 2] =
            (i >>> ((k + g) | 0)) | (f[h >> 2] & ~(-1 >>> ((32 - j) | 0)));
          f[l >> 2] = j;
          e = j;
        }
        c = (c + 4) | 0;
        f[b >> 2] = c;
        g = (n - m) | 0;
      }
      p = (32 - e) | 0;
      o = -1 << e;
      if (g >>> 0 > 31) {
        n = ~o;
        m = f[d >> 2] | 0;
        j = (g + -32) | 0;
        h = j >>> 5;
        i = (h + 1) | 0;
        h = (j - (h << 5)) | 0;
        j = f[m >> 2] | 0;
        k = m;
        e = g;
        g = c;
        while (1) {
          q = f[g >> 2] | 0;
          r = j & n;
          f[k >> 2] = r;
          f[k >> 2] = (q << f[l >> 2]) | r;
          k = (k + 4) | 0;
          j = (f[k >> 2] & o) | (q >>> p);
          f[k >> 2] = j;
          e = (e + -32) | 0;
          if (e >>> 0 <= 31) break;
          else g = (g + 4) | 0;
        }
        c = (c + (i << 2)) | 0;
        f[b >> 2] = c;
        f[d >> 2] = m + (i << 2);
      } else h = g;
      if (!h) {
        q = l;
        r = f[d >> 2] | 0;
        f[a >> 2] = r;
        r = (a + 4) | 0;
        q = f[q >> 2] | 0;
        f[r >> 2] = q;
        return;
      }
      i = f[c >> 2] & (-1 >>> ((32 - h) | 0));
      g = (p | 0) < (h | 0) ? p : h;
      e = f[d >> 2] | 0;
      c = f[e >> 2] & ~((-1 << f[l >> 2]) & (-1 >>> ((p - g) | 0)));
      f[e >> 2] = c;
      f[e >> 2] = c | (i << f[l >> 2]);
      c = ((f[l >> 2] | 0) + g) | 0;
      e = (e + (c >>> 5 << 2)) | 0;
      f[d >> 2] = e;
      f[l >> 2] = c & 31;
      c = (h - g) | 0;
      if ((c | 0) <= 0) {
        q = l;
        r = f[d >> 2] | 0;
        f[a >> 2] = r;
        r = (a + 4) | 0;
        q = f[q >> 2] | 0;
        f[r >> 2] = q;
        return;
      }
      f[e >> 2] = (f[e >> 2] & ~(-1 >>> ((32 - c) | 0))) | (i >>> g);
      f[l >> 2] = c;
      q = l;
      r = f[d >> 2] | 0;
      f[a >> 2] = r;
      r = (a + 4) | 0;
      q = f[q >> 2] | 0;
      f[r >> 2] = q;
      return;
    }
    function Ef(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      r = u;
      u = (u + 32) | 0;
      i = (r + 16) | 0;
      q = r;
      f[i >> 2] = 0;
      do
        if ((j[(b + 38) >> 1] | 0) < 514) {
          k = (b + 8) | 0;
          l = f[k >> 2] | 0;
          k = f[(k + 4) >> 2] | 0;
          g = (b + 16) | 0;
          c = g;
          e = f[c >> 2] | 0;
          c = sq(e | 0, f[(c + 4) >> 2] | 0, 4, 0) | 0;
          d = I;
          if (
            ((k | 0) < (d | 0)) |
            (((k | 0) == (d | 0)) & (l >>> 0 < c >>> 0))
          ) {
            q = 0;
            u = r;
            return q | 0;
          } else {
            l = ((f[b >> 2] | 0) + e) | 0;
            l =
              h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24);
            f[i >> 2] = l;
            k = g;
            f[k >> 2] = c;
            f[(k + 4) >> 2] = d;
            c = l;
            break;
          }
        } else if (_k(i, b) | 0) {
          c = f[i >> 2] | 0;
          break;
        } else {
          q = 0;
          u = r;
          return q | 0;
        }
      while (0);
      e = (a + 76) | 0;
      jg(e, c, 0);
      is(q);
      if (lg(q, b) | 0) {
        if (f[i >> 2] | 0) {
          c = 0;
          d = 1;
          do {
            d = d ^ ((km(q) | 0) ^ 1);
            l = ((f[e >> 2] | 0) + (c >>> 5 << 2)) | 0;
            k = 1 << (c & 31);
            g = f[l >> 2] | 0;
            f[l >> 2] = d ? g | k : g & ~k;
            c = (c + 1) | 0;
          } while (c >>> 0 < (f[i >> 2] | 0) >>> 0);
        }
        d = (b + 8) | 0;
        c = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        l = (b + 16) | 0;
        g = l;
        e = f[g >> 2] | 0;
        g = f[(g + 4) >> 2] | 0;
        i = sq(e | 0, g | 0, 4, 0) | 0;
        k = I;
        if (
          !(((d | 0) < (k | 0)) | (((d | 0) == (k | 0)) & (c >>> 0 < i >>> 0)))
            ? (
                (m = f[b >> 2] | 0),
                (n = (m + e) | 0),
                (n =
                  h[n >> 0] |
                  (h[(n + 1) >> 0] << 8) |
                  (h[(n + 2) >> 0] << 16) |
                  (h[(n + 3) >> 0] << 24)),
                (o = l),
                (f[o >> 2] = i),
                (f[(o + 4) >> 2] = k),
                (o = sq(e | 0, g | 0, 8, 0) | 0),
                (p = I),
                !(
                  ((d | 0) < (p | 0)) |
                  (((d | 0) == (p | 0)) & (c >>> 0 < o >>> 0))
                )
              )
            : 0
        ) {
          b = (m + i) | 0;
          b =
            h[b >> 0] |
            (h[(b + 1) >> 0] << 8) |
            (h[(b + 2) >> 0] << 16) |
            (h[(b + 3) >> 0] << 24);
          c = l;
          f[c >> 2] = o;
          f[(c + 4) >> 2] = p;
          f[(a + 12) >> 2] = n;
          f[(a + 16) >> 2] = b;
          b = (b + (1 - n)) | 0;
          f[(a + 20) >> 2] = b;
          c = ((b | 0) / 2) | 0;
          d = (a + 24) | 0;
          f[d >> 2] = c;
          f[(a + 28) >> 2] = 0 - c;
          if (!(b & 1)) {
            f[d >> 2] = c + -1;
            c = 1;
          } else c = 1;
        } else c = 0;
      } else c = 0;
      Ss(q);
      q = c;
      u = r;
      return q | 0;
    }
    function Ff(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 4) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      lb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function Gf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 4) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      pb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function Hf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 4) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      mb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function If(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 16, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 24, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 32, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Jf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Kf(a) {
      a = a | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      h = (a + 32) | 0;
      c = f[h >> 2] | 0;
      o = (c + 8) | 0;
      n = f[(o + 4) >> 2] | 0;
      g = (c + 16) | 0;
      d = g;
      e = f[d >> 2] | 0;
      d = f[(d + 4) >> 2] | 0;
      if (
        !(
          ((n | 0) > (d | 0)) |
          ((n | 0) == (d | 0) ? (f[o >> 2] | 0) >>> 0 > e >>> 0 : 0)
        )
      ) {
        a = 0;
        return a | 0;
      }
      n = b[((f[c >> 2] | 0) + e) >> 0] | 0;
      m = sq(e | 0, d | 0, 1, 0) | 0;
      o = g;
      f[o >> 2] = m;
      f[(o + 4) >> 2] = I;
      o = n & 255;
      g = n << 24 >> 24 == 0;
      a: do
        if (!g) {
          c = 0;
          while (1) {
            if (!(Wa[f[((f[a >> 2] | 0) + 16) >> 2] & 127](a, c) | 0)) {
              c = 0;
              break;
            }
            c = (c + 1) | 0;
            if ((c | 0) >= (o | 0)) break a;
          }
          return c | 0;
        }
      while (0);
      n = (a + 8) | 0;
      c = f[n >> 2] | 0;
      d = f[(a + 12) >> 2] | 0;
      b: do
        if ((c | 0) != (d | 0)) {
          e = (a + 4) | 0;
          while (1) {
            m = f[c >> 2] | 0;
            c = (c + 4) | 0;
            if (
              !(Na[f[((f[m >> 2] | 0) + 8) >> 2] & 31](m, a, f[e >> 2] | 0) | 0)
            ) {
              c = 0;
              break;
            }
            if ((c | 0) == (d | 0)) break b;
          }
          return c | 0;
        }
      while (0);
      if (!g) {
        c = 0;
        do {
          m = f[((f[n >> 2] | 0) + (c << 2)) >> 2] | 0;
          c = (c + 1) | 0;
          if (
            !(Wa[f[((f[m >> 2] | 0) + 12) >> 2] & 127](m, f[h >> 2] | 0) | 0)
          ) {
            c = 0;
            i = 26;
            break;
          }
        } while ((c | 0) < (o | 0));
        if ((i | 0) == 26) return c | 0;
        if (!g) {
          i = (a + 20) | 0;
          h = (a + 24) | 0;
          l = 0;
          do {
            j = f[((f[n >> 2] | 0) + (l << 2)) >> 2] | 0;
            j = Sa[f[((f[j >> 2] | 0) + 24) >> 2] & 255](j) | 0;
            if ((j | 0) > 0) {
              m = 0;
              do {
                k = f[((f[n >> 2] | 0) + (l << 2)) >> 2] | 0;
                k = Wa[f[((f[k >> 2] | 0) + 20) >> 2] & 127](k, m) | 0;
                d = f[h >> 2] | 0;
                c = f[i >> 2] | 0;
                g = (d - c) >> 2;
                do
                  if (k >>> 0 >= g >>> 0) {
                    e = (k + 1) | 0;
                    if (e >>> 0 > g >>> 0) {
                      Tj(i, (e - g) | 0);
                      c = f[i >> 2] | 0;
                      break;
                    }
                    if (
                      e >>> 0 < g >>> 0
                        ? ((p = (c + (e << 2)) | 0), (d | 0) != (p | 0))
                        : 0
                    )
                      f[h >> 2] = d + (~(((d + -4 - p) | 0) >>> 2) << 2);
                  }
                while (0);
                f[(c + (k << 2)) >> 2] = l;
                m = (m + 1) | 0;
              } while ((m | 0) != (j | 0));
            }
            l = (l + 1) | 0;
          } while ((l | 0) != (o | 0));
        }
      }
      if (!(Sa[f[((f[a >> 2] | 0) + 28) >> 2] & 255](a) | 0)) {
        a = 0;
        return a | 0;
      }
      a = Sa[f[((f[a >> 2] | 0) + 32) >> 2] & 255](a) | 0;
      return a | 0;
    }
    function Lf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 4194304) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 1073741824;
      u = q;
      return a | 0;
    }
    function Mf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 2097152) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 536870912;
      u = q;
      return a | 0;
    }
    function Nf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 1048576) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 268435456;
      u = q;
      return a | 0;
    }
    function Of(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 262144) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 67108864;
      u = q;
      return a | 0;
    }
    function Pf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 131072) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 33554432;
      u = q;
      return a | 0;
    }
    function Qf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 32768) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 8388608;
      u = q;
      return a | 0;
    }
    function Rf(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      g = q;
      do
        if ((j[(c + 38) >> 1] | 0) < 512) {
          i = (c + 8) | 0;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          o = (c + 16) | 0;
          k = o;
          e = f[k >> 2] | 0;
          k = sq(e | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
          l = I;
          if (
            ((i | 0) < (l | 0)) |
            (((i | 0) == (l | 0)) & (d >>> 0 < k >>> 0))
          ) {
            a = 0;
            u = q;
            return a | 0;
          } else {
            m = ((f[c >> 2] | 0) + e) | 0;
            n = m;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            m = (m + 4) | 0;
            m =
              h[m >> 0] |
              (h[(m + 1) >> 0] << 8) |
              (h[(m + 2) >> 0] << 16) |
              (h[(m + 3) >> 0] << 24);
            e = g;
            f[e >> 2] = n;
            f[(e + 4) >> 2] = m;
            e = o;
            f[e >> 2] = k;
            f[(e + 4) >> 2] = l;
            e = o;
            break;
          }
        } else if (vk(g, c) | 0) {
          n = g;
          i = (c + 8) | 0;
          e = (c + 16) | 0;
          l = e;
          d = f[i >> 2] | 0;
          i = f[(i + 4) >> 2] | 0;
          k = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          m = f[(n + 4) >> 2] | 0;
          n = f[n >> 2] | 0;
          break;
        } else {
          a = 0;
          u = q;
          return a | 0;
        }
      while (0);
      o = Ip(d | 0, i | 0, k | 0, l | 0) | 0;
      i = I;
      if ((m >>> 0 > i >>> 0) | (((m | 0) == (i | 0)) & (n >>> 0 > o >>> 0))) {
        a = 0;
        u = q;
        return a | 0;
      }
      g = ((f[c >> 2] | 0) + k) | 0;
      o = sq(k | 0, l | 0, n | 0, m | 0) | 0;
      c = e;
      f[c >> 2] = o;
      f[(c + 4) >> 2] = I;
      if ((n | 0) < 1) {
        a = 0;
        u = q;
        return a | 0;
      }
      f[(a + 40) >> 2] = g;
      e = (n + -1) | 0;
      d = (g + e) | 0;
      a: do
        switch (((h[d >> 0] | 0) >>> 6) & 3) {
          case 0: {
            f[(a + 44) >> 2] = e;
            p = b[d >> 0] & 63;
            break;
          }
          case 1:
            if ((n | 0) < 2) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -2;
              p = (g + n + -2) | 0;
              p = (((h[(p + 1) >> 0] | 0) << 8) & 16128) | (h[p >> 0] | 0);
              break a;
            }
          case 2:
            if ((n | 0) < 3) {
              a = 0;
              u = q;
              return a | 0;
            } else {
              f[(a + 44) >> 2] = n + -3;
              p = (g + n + -3) | 0;
              p =
                ((h[(p + 1) >> 0] | 0) << 8) |
                (h[p >> 0] | 0) |
                (((h[(p + 2) >> 0] | 0) << 16) & 4128768);
              break a;
            }
          case 3: {
            f[(a + 44) >> 2] = n + -4;
            p = (g + n + -4) | 0;
            p =
              ((h[(p + 2) >> 0] | 0) << 16) |
              (((h[(p + 3) >> 0] | 0) << 24) & 1056964608) |
              ((h[(p + 1) >> 0] | 0) << 8) |
              (h[p >> 0] | 0);
            break;
          }
          default: {
          }
        }
      while (0);
      p = (p + 16384) | 0;
      f[(a + 48) >> 2] = p;
      a = p >>> 0 < 4194304;
      u = q;
      return a | 0;
    }
    function Sf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = b[(c + e) >> 0];
          f[(d + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = (j & 65535) << 24 >> 24;
          f[(d + 4) >> 2] = (((j & 65535) >>> 8) & 65535) << 24 >> 24;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = b[(i + 1) >> 0] | 0;
          f[d >> 2] = b[i >> 0];
          f[(d + 4) >> 2] = j << 24 >> 24;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j << 24 >> 24;
          f[(d + 4) >> 2] = j << 16 >> 24;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Tf(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      x = u;
      u = (u + 16) | 0;
      v = (x + 4) | 0;
      t = x;
      w = (a + 60) | 0;
      f[(a + 64) >> 2] = g;
      s = (a + 8) | 0;
      f[s >> 2] = e;
      i = (a + 32) | 0;
      h = (a + 36) | 0;
      g = f[h >> 2] | 0;
      d = f[i >> 2] | 0;
      j = (g - d) >> 2;
      if (j >>> 0 >= e >>> 0) {
        if (
          j >>> 0 > e >>> 0 ? ((k = (d + (e << 2)) | 0), (g | 0) != (k | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - k) | 0) >>> 2) << 2);
      } else Tj(i, (e - j) | 0);
      n = (a + 56) | 0;
      i = f[n >> 2] | 0;
      g = f[(i + 4) >> 2] | 0;
      d = f[i >> 2] | 0;
      q = (g - d) | 0;
      r = q >> 2;
      if ((q | 0) <= 0) {
        u = x;
        return 1;
      }
      p = (a + 16) | 0;
      m = (a + 32) | 0;
      q = (a + 12) | 0;
      o = (a + 20) | 0;
      h = 0;
      while (1) {
        if ((g - d) >> 2 >>> 0 <= h >>> 0) {
          wr(i);
          d = f[i >> 2] | 0;
        }
        f[t >> 2] = f[(d + (h << 2)) >> 2];
        f[v >> 2] = f[t >> 2];
        Rb(w, v, c, h);
        l = X(h, e) | 0;
        k = (b + (l << 2)) | 0;
        l = (c + (l << 2)) | 0;
        if ((f[s >> 2] | 0) > 0) {
          i = 0;
          do {
            d = f[(a + 68 + (i << 2)) >> 2] | 0;
            g = f[p >> 2] | 0;
            if ((d | 0) > (g | 0)) {
              j = f[m >> 2] | 0;
              f[(j + (i << 2)) >> 2] = g;
            } else {
              g = f[q >> 2] | 0;
              j = f[m >> 2] | 0;
              f[(j + (i << 2)) >> 2] = (d | 0) < (g | 0) ? g : d;
            }
            i = (i + 1) | 0;
            d = f[s >> 2] | 0;
          } while ((i | 0) < (d | 0));
          if ((d | 0) > 0) {
            i = 0;
            do {
              d =
                ((f[(k + (i << 2)) >> 2] | 0) + (f[(j + (i << 2)) >> 2] | 0)) |
                0;
              g = (l + (i << 2)) | 0;
              f[g >> 2] = d;
              if ((d | 0) <= (f[p >> 2] | 0)) {
                if ((d | 0) < (f[q >> 2] | 0)) {
                  d = ((f[o >> 2] | 0) + d) | 0;
                  y = 22;
                }
              } else {
                d = (d - (f[o >> 2] | 0)) | 0;
                y = 22;
              }
              if ((y | 0) == 22) {
                y = 0;
                f[g >> 2] = d;
              }
              i = (i + 1) | 0;
            } while ((i | 0) < (f[s >> 2] | 0));
          }
        }
        h = (h + 1) | 0;
        if ((h | 0) >= (r | 0)) break;
        i = f[n >> 2] | 0;
        d = f[i >> 2] | 0;
        g = f[(i + 4) >> 2] | 0;
      }
      u = x;
      return 1;
    }
    function Uf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 8) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      o = f[(d + 4) >> 2] | 0;
      q = m;
      f[q >> 2] = f[d >> 2];
      f[(q + 4) >> 2] = o;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      jb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function Vf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 8) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      o = f[(d + 4) >> 2] | 0;
      q = m;
      f[q >> 2] = f[d >> 2];
      f[(q + 4) >> 2] = o;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      nb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function Wf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      p = u;
      u = (u + 16) | 0;
      n = (p + 8) | 0;
      m = p;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      r = I;
      if (((k | 0) < (r | 0)) | (((k | 0) == (r | 0)) & (e >>> 0 < q >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      r = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((i | 0) < (q | 0)) | (((i | 0) == (q | 0)) & (e >>> 0 < r >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        q = l;
        q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, 4, 0) | 0;
        r = l;
        f[r >> 2] = q;
        f[(r + 4) >> 2] = I;
      }
      if (!e) {
        r = 1;
        u = p;
        return r | 0;
      } else e = 0;
      do {
        if (!(lg((a + 12 + (e << 4)) | 0, c) | 0)) {
          e = 0;
          o = 14;
          break;
        }
        e = (e + 1) | 0;
      } while ((e | 0) < 32);
      if ((o | 0) == 14) {
        u = p;
        return e | 0;
      }
      if (!(lg((a + 524) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 540) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 560) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      if (!(mh((a + 580) | 0, c) | 0)) {
        r = 0;
        u = p;
        return r | 0;
      }
      r = f[k >> 2] | 0;
      o = f[(d + 4) >> 2] | 0;
      q = m;
      f[q >> 2] = f[d >> 2];
      f[(q + 4) >> 2] = o;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      kb(a, r, n);
      r = 1;
      u = p;
      return r | 0;
    }
    function Xf(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0;
      f[a >> 2] = 4744;
      ol((a + 240) | 0);
      ak((a + 224) | 0);
      b = f[(a + 208) >> 2] | 0;
      if (b | 0) {
        d = (a + 212) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 196) >> 2] | 0;
      if (b | 0) {
        d = (a + 200) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 184) >> 2] | 0;
      if (b | 0) {
        d = (a + 188) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 172) >> 2] | 0;
      if (b | 0) {
        d = (a + 176) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 156) >> 2] | 0;
      if (b | 0)
        do {
          d = b;
          b = f[b >> 2] | 0;
          Ns(d);
        } while ((b | 0) != 0);
      d = (a + 148) | 0;
      b = f[d >> 2] | 0;
      f[d >> 2] = 0;
      if (b | 0) Ns(b);
      b = f[(a + 132) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 120) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 108) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 84) >> 2] | 0;
      if (b | 0) {
        d = (a + 88) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 72) >> 2] | 0;
      if (b | 0) {
        d = (a + 76) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 60) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 48) >> 2] | 0;
      if (b | 0) {
        d = (a + 52) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 36) >> 2] | 0;
      if (b | 0) {
        d = (a + 40) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] =
            c + ((~(((((c + -12 - b) | 0) >>> 0) / 12) | 0) * 12) | 0);
        Ns(b);
      }
      b = f[(a + 24) >> 2] | 0;
      if (b | 0) {
        d = (a + 28) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 12) >> 2] | 0;
      if (b | 0) {
        d = (a + 16) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      a = (a + 8) | 0;
      b = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (!b) return;
      Vk(b);
      Ns(b);
      return;
    }
    function Yf(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          a = g;
          g = (g + 4) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = d;
          f[i >> 2] =
            h[a >> 0] |
            (h[(a + 1) >> 0] << 8) |
            (h[(a + 2) >> 0] << 16) |
            (h[(a + 3) >> 0] << 24);
          f[(i + 4) >> 2] = g;
          i = (d + 8) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 16, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 24, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 32, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          _n(d | 0, (c + e) | 0, 16) | 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Zf(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      m = f[b >> 2] | 0;
      k = (b + 4) | 0;
      e = f[k >> 2] | 0;
      h = ((((f[c >> 2] | 0) - m) << 3) + (f[(c + 4) >> 2] | 0) - e) | 0;
      c = m;
      if ((h | 0) <= 0) {
        b = (d + 4) | 0;
        d = f[d >> 2] | 0;
        f[a >> 2] = d;
        a = (a + 4) | 0;
        d = f[b >> 2] | 0;
        f[a >> 2] = d;
        return;
      }
      if (!e) {
        l = (d + 4) | 0;
        e = f[l >> 2] | 0;
      } else {
        i = (32 - e) | 0;
        m = (h | 0) < (i | 0) ? h : i;
        i = (-1 >>> ((i - m) | 0)) & (-1 << e) & f[c >> 2];
        l = (d + 4) | 0;
        c = f[l >> 2] | 0;
        j = (32 - c) | 0;
        e = j >>> 0 < m >>> 0 ? j : m;
        g = f[d >> 2] | 0;
        c = f[g >> 2] & ~((-1 >>> ((j - e) | 0)) & (-1 << c));
        f[g >> 2] = c;
        j = f[l >> 2] | 0;
        n = f[k >> 2] | 0;
        f[g >> 2] =
          (j >>> 0 > n >>> 0 ? i << (j - n) : i >>> ((n - j) | 0)) | c;
        c = ((f[l >> 2] | 0) + e) | 0;
        g = (g + (c >>> 5 << 2)) | 0;
        f[d >> 2] = g;
        c = c & 31;
        f[l >> 2] = c;
        j = (m - e) | 0;
        if ((j | 0) > 0) {
          c = f[g >> 2] & ~(-1 >>> ((32 - j) | 0));
          f[g >> 2] = c;
          f[g >> 2] = (i >>> (((f[k >> 2] | 0) + e) | 0)) | c;
          f[l >> 2] = j;
          c = j;
        }
        n = ((f[b >> 2] | 0) + 4) | 0;
        f[b >> 2] = n;
        e = c;
        c = n;
        h = (h - m) | 0;
      }
      j = (32 - e) | 0;
      i = -1 << e;
      if (h >>> 0 > 31) {
        g = ~i;
        e = h;
        do {
          m = f[c >> 2] | 0;
          n = f[d >> 2] | 0;
          k = f[n >> 2] & g;
          f[n >> 2] = k;
          f[n >> 2] = (m << f[l >> 2]) | k;
          n = (n + 4) | 0;
          f[d >> 2] = n;
          f[n >> 2] = (f[n >> 2] & i) | (m >>> j);
          e = (e + -32) | 0;
          c = ((f[b >> 2] | 0) + 4) | 0;
          f[b >> 2] = c;
        } while (e >>> 0 > 31);
        h = h & 31;
      }
      if (!h) {
        b = l;
        n = f[d >> 2] | 0;
        f[a >> 2] = n;
        n = (a + 4) | 0;
        a = f[b >> 2] | 0;
        f[n >> 2] = a;
        return;
      }
      i = f[c >> 2] & (-1 >>> ((32 - h) | 0));
      g = (j | 0) < (h | 0) ? j : h;
      e = f[d >> 2] | 0;
      c = f[e >> 2] & ~((-1 << f[l >> 2]) & (-1 >>> ((j - g) | 0)));
      f[e >> 2] = c;
      f[e >> 2] = c | (i << f[l >> 2]);
      c = ((f[l >> 2] | 0) + g) | 0;
      e = (e + (c >>> 5 << 2)) | 0;
      f[d >> 2] = e;
      f[l >> 2] = c & 31;
      c = (h - g) | 0;
      if ((c | 0) <= 0) {
        b = l;
        n = f[d >> 2] | 0;
        f[a >> 2] = n;
        n = (a + 4) | 0;
        a = f[b >> 2] | 0;
        f[n >> 2] = a;
        return;
      }
      f[e >> 2] = (f[e >> 2] & ~(-1 >>> ((32 - c) | 0))) | (i >>> g);
      f[l >> 2] = c;
      b = l;
      n = f[d >> 2] | 0;
      f[a >> 2] = n;
      n = (a + 4) | 0;
      a = f[b >> 2] | 0;
      f[n >> 2] = a;
      return;
    }
    function _f(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0;
      f[a >> 2] = 4792;
      mi((a + 240) | 0);
      ak((a + 224) | 0);
      b = f[(a + 208) >> 2] | 0;
      if (b | 0) {
        d = (a + 212) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 196) >> 2] | 0;
      if (b | 0) {
        d = (a + 200) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 184) >> 2] | 0;
      if (b | 0) {
        d = (a + 188) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 172) >> 2] | 0;
      if (b | 0) {
        d = (a + 176) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 156) >> 2] | 0;
      if (b | 0)
        do {
          d = b;
          b = f[b >> 2] | 0;
          Ns(d);
        } while ((b | 0) != 0);
      d = (a + 148) | 0;
      b = f[d >> 2] | 0;
      f[d >> 2] = 0;
      if (b | 0) Ns(b);
      b = f[(a + 132) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 120) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 108) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 84) >> 2] | 0;
      if (b | 0) {
        d = (a + 88) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 72) >> 2] | 0;
      if (b | 0) {
        d = (a + 76) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 60) >> 2] | 0;
      if (b | 0) Ns(b);
      b = f[(a + 48) >> 2] | 0;
      if (b | 0) {
        d = (a + 52) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 36) >> 2] | 0;
      if (b | 0) {
        d = (a + 40) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] =
            c + ((~(((((c + -12 - b) | 0) >>> 0) / 12) | 0) * 12) | 0);
        Ns(b);
      }
      b = f[(a + 24) >> 2] | 0;
      if (b | 0) {
        d = (a + 28) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 12) >> 2] | 0;
      if (b | 0) {
        d = (a + 16) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      a = (a + 8) | 0;
      b = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (!b) return;
      Vk(b);
      Ns(b);
      return;
    }
    function $f(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      x = u;
      u = (u + 16) | 0;
      v = (x + 4) | 0;
      t = x;
      w = (a + 60) | 0;
      f[(a + 64) >> 2] = g;
      s = (a + 8) | 0;
      f[s >> 2] = e;
      i = (a + 32) | 0;
      h = (a + 36) | 0;
      g = f[h >> 2] | 0;
      d = f[i >> 2] | 0;
      j = (g - d) >> 2;
      if (j >>> 0 >= e >>> 0) {
        if (
          j >>> 0 > e >>> 0 ? ((k = (d + (e << 2)) | 0), (g | 0) != (k | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - k) | 0) >>> 2) << 2);
      } else Tj(i, (e - j) | 0);
      n = (a + 56) | 0;
      i = f[n >> 2] | 0;
      g = f[(i + 4) >> 2] | 0;
      d = f[i >> 2] | 0;
      q = (g - d) | 0;
      r = q >> 2;
      if ((q | 0) <= 0) {
        u = x;
        return 1;
      }
      p = (a + 16) | 0;
      m = (a + 32) | 0;
      q = (a + 12) | 0;
      o = (a + 20) | 0;
      h = 0;
      while (1) {
        if ((g - d) >> 2 >>> 0 <= h >>> 0) {
          wr(i);
          d = f[i >> 2] | 0;
        }
        f[t >> 2] = f[(d + (h << 2)) >> 2];
        f[v >> 2] = f[t >> 2];
        Pb(w, v, c, h);
        l = X(h, e) | 0;
        k = (b + (l << 2)) | 0;
        l = (c + (l << 2)) | 0;
        if ((f[s >> 2] | 0) > 0) {
          i = 0;
          do {
            d = f[(a + 68 + (i << 2)) >> 2] | 0;
            g = f[p >> 2] | 0;
            if ((d | 0) > (g | 0)) {
              j = f[m >> 2] | 0;
              f[(j + (i << 2)) >> 2] = g;
            } else {
              g = f[q >> 2] | 0;
              j = f[m >> 2] | 0;
              f[(j + (i << 2)) >> 2] = (d | 0) < (g | 0) ? g : d;
            }
            i = (i + 1) | 0;
            d = f[s >> 2] | 0;
          } while ((i | 0) < (d | 0));
          if ((d | 0) > 0) {
            i = 0;
            do {
              d =
                ((f[(k + (i << 2)) >> 2] | 0) + (f[(j + (i << 2)) >> 2] | 0)) |
                0;
              g = (l + (i << 2)) | 0;
              f[g >> 2] = d;
              if ((d | 0) <= (f[p >> 2] | 0)) {
                if ((d | 0) < (f[q >> 2] | 0)) {
                  d = ((f[o >> 2] | 0) + d) | 0;
                  y = 22;
                }
              } else {
                d = (d - (f[o >> 2] | 0)) | 0;
                y = 22;
              }
              if ((y | 0) == 22) {
                y = 0;
                f[g >> 2] = d;
              }
              i = (i + 1) | 0;
            } while ((i | 0) < (f[s >> 2] | 0));
          }
        }
        h = (h + 1) | 0;
        if ((h | 0) >= (r | 0)) break;
        i = f[n >> 2] | 0;
        d = f[i >> 2] | 0;
        g = f[(i + 4) >> 2] | 0;
      }
      u = x;
      return 1;
    }
    function ag(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) << 16 >> 16;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) <<
            16 >>
            16;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] = (h[j >> 0] | (h[(j + 1) >> 0] << 8)) << 16 >> 16;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) <<
            16 >>
            16;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function bg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = h[(c + e) >> 0];
          f[(d + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j = h[j >> 0] | (h[(j + 1) >> 0] << 8);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = ((j & 65535) >>> 8) & 65535;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = b[(i + 1) >> 0] | 0;
          f[d >> 2] = h[i >> 0];
          f[(d + 4) >> 2] = j & 255;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          f[d >> 2] = j & 255;
          f[(d + 4) >> 2] = (j >>> 8) & 255;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function cg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          f[d >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 65535;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
            65535;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 6, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] = (h[j >> 0] | (h[(j + 1) >> 0] << 8)) & 65535;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 8, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
            65535;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function dg(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      l = (b + 16) | 0;
      n = f[l >> 2] | 0;
      i = ((f[c >> 2] | 0) - n) | 0;
      j = (c + 4) | 0;
      g = ((f[j >> 2] | 0) - n) | 0;
      e = c;
      f[e >> 2] = i;
      f[(e + 4) >> 2] = g;
      e = f[l >> 2] | 0;
      if ((e | 0) < (i | 0)) Ga(11106, 10407, 250, 11129);
      if ((e | 0) < (g | 0)) Ga(11141, 10407, 251, 11129);
      h = (0 - e) | 0;
      if ((i | 0) < (h | 0)) Ga(11164, 10407, 252, 11129);
      if ((g | 0) < (h | 0)) Ga(11188, 10407, 253, 11129);
      m =
        ((((g | 0) > -1 ? g : (0 - g) | 0) + ((i | 0) > -1 ? i : (0 - i) | 0)) |
          0) <=
        (e | 0);
      if (!m) {
        vj((b + 4) | 0, c, j);
        i = f[c >> 2] | 0;
      }
      if (!i) {
        e = f[j >> 2] | 0;
        g = e;
        e = (e | 0) == 0;
      } else {
        e = f[j >> 2] | 0;
        g = e;
        e = ((i | 0) < 0) & ((e | 0) < 1);
      }
      if (!i) k = (g | 0) == 0 ? 0 : (g | 0) > 0 ? 3 : 1;
      else k = (i | 0) > 0 ? ((g >> 31) + 2) | 0 : (g | 0) < 1 ? 0 : 3;
      if (e) {
        e = i;
        i = 1;
      } else {
        switch (k | 0) {
          case 1: {
            e = g;
            g = (0 - i) | 0;
            break;
          }
          case 2: {
            e = (0 - i) | 0;
            g = (0 - g) | 0;
            break;
          }
          case 3: {
            e = (0 - g) | 0;
            g = i;
            break;
          }
          default:
            e = i;
        }
        i = c;
        f[i >> 2] = e;
        f[(i + 4) >> 2] = g;
        i = 0;
      }
      e = ((f[d >> 2] | 0) + e) | 0;
      f[a >> 2] = e;
      g = ((f[(d + 4) >> 2] | 0) + g) | 0;
      j = (a + 4) | 0;
      f[j >> 2] = g;
      h = f[l >> 2] | 0;
      if ((h | 0) >= (e | 0)) {
        if ((e | 0) < ((0 - h) | 0)) e = ((f[(b + 8) >> 2] | 0) + e) | 0;
      } else e = (e - (f[(b + 8) >> 2] | 0)) | 0;
      f[a >> 2] = e;
      if ((h | 0) >= (g | 0)) {
        if ((g | 0) < ((0 - h) | 0)) g = ((f[(b + 8) >> 2] | 0) + g) | 0;
      } else g = (g - (f[(b + 8) >> 2] | 0)) | 0;
      f[j >> 2] = g;
      if (!i) {
        switch ((((4 - k) | 0) % 4) | 0 | 0) {
          case 1: {
            h = g;
            e = (0 - e) | 0;
            break;
          }
          case 2: {
            h = (0 - e) | 0;
            e = (0 - g) | 0;
            break;
          }
          case 3: {
            h = (0 - g) | 0;
            break;
          }
          default: {
            h = e;
            e = g;
          }
        }
        g = a;
        f[g >> 2] = h;
        f[(g + 4) >> 2] = e;
        g = e;
        e = h;
      }
      if (m) {
        m = e;
        b = g;
        m = (m + n) | 0;
        n = (b + n) | 0;
        b = a;
        a = b;
        f[a >> 2] = m;
        b = (b + 4) | 0;
        f[b >> 2] = n;
        return;
      }
      vj((b + 4) | 0, a, j);
      m = f[a >> 2] | 0;
      b = f[j >> 2] | 0;
      m = (m + n) | 0;
      n = (b + n) | 0;
      b = a;
      a = b;
      f[a >> 2] = m;
      b = (b + 4) | 0;
      f[b >> 2] = n;
      return;
    }
    function eg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = La,
        k = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          j = $(((b[(c + e) >> 0] | 0) != 0) & 1);
          n[d >> 2] = j;
          i = 1;
          return i | 0;
        }
        case 2: {
          k = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                k | 0,
                (((k | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          k = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((k | 0) > 0) |
            ((k | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (c + e) | 0;
          j = $(
            (((h[k >> 0] | (h[(k + 1) >> 0] << 8)) & 255) << 24 >> 24 != 0) & 1
          );
          n[d >> 2] = j;
          k = 1;
          return k | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          k = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          k = f[a >> 2] | 0;
          c = f[k >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(k + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          j = $(((b[(c + e) >> 0] | 0) != 0) & 1);
          n[d >> 2] = j;
          k = 1;
          return k | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          k = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          k = f[a >> 2] | 0;
          c = f[k >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(k + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (c + e) | 0;
          j = $(
            (((h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24)) &
              255) <<
              24 >>
              24 !=
              0) &
              1
          );
          n[d >> 2] = j;
          k = 1;
          return k | 0;
        }
        default: {
          k = 0;
          return k | 0;
        }
      }
      return 0;
    }
    function fg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0;
      w = u;
      u = (u + 48) | 0;
      s = (w + 40) | 0;
      t = (w + 24) | 0;
      p = (w + 20) | 0;
      q = (w + 16) | 0;
      n = w;
      r = (w + 8) | 0;
      f[t >> 2] = 0;
      v = (t + 4) | 0;
      f[v >> 2] = 0;
      f[(t + 8) >> 2] = 0;
      l = (c + 8) | 0;
      k = f[l >> 2] | 0;
      l = f[(l + 4) >> 2] | 0;
      o = (c + 16) | 0;
      e = o;
      m = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      g = sq(m | 0, e | 0, 4, 0) | 0;
      i = I;
      a: do
        if (((l | 0) < (i | 0)) | (((l | 0) == (i | 0)) & (k >>> 0 < g >>> 0)))
          i = 0;
        else {
          j = f[c >> 2] | 0;
          x = (j + m) | 0;
          x =
            h[x >> 0] |
            (h[(x + 1) >> 0] << 8) |
            (h[(x + 2) >> 0] << 16) |
            (h[(x + 3) >> 0] << 24);
          y = o;
          f[y >> 2] = g;
          f[(y + 4) >> 2] = i;
          b: do
            switch (x | 0) {
              case 3: {
                if (
                  !(
                    ((l | 0) > (i | 0)) |
                    (((l | 0) == (i | 0)) & (k >>> 0 > g >>> 0))
                  )
                ) {
                  i = 0;
                  break a;
                }
                y = b[(j + g) >> 0] | 0;
                m = sq(m | 0, e | 0, 5, 0) | 0;
                x = o;
                f[x >> 2] = m;
                f[(x + 4) >> 2] = I;
                f[(a + 8) >> 2] = y << 24 >> 24;
                if (y << 24 >> 24 == 1)
                  if (pc(a, c, t) | 0) break b;
                  else {
                    i = 0;
                    break a;
                  }
                else {
                  qn(6682, 23, 1, f[1293] | 0) | 0;
                  i = 0;
                  break a;
                }
              }
              case 2: {
                if (!(pc(a, c, t) | 0)) {
                  i = 0;
                  break a;
                }
                break;
              }
              default: {
                qn(6706, 24, 1, f[1293] | 0) | 0;
                i = 0;
                break a;
              }
            }
          while (0);
          f[p >> 2] = f[t >> 2];
          f[q >> 2] = f[v >> 2];
          x = d;
          y = f[(x + 4) >> 2] | 0;
          i = n;
          f[i >> 2] = f[x >> 2];
          f[(i + 4) >> 2] = y;
          f[s >> 2] = f[n >> 2];
          f[(s + 4) >> 2] = f[(n + 4) >> 2];
          Hg(r, p, q, a, s);
          i = 1;
        }
      while (0);
      e = f[t >> 2] | 0;
      if (!e) {
        u = w;
        return i | 0;
      }
      g = f[v >> 2] | 0;
      if ((g | 0) != (e | 0))
        f[v >> 2] = g + ((~(((((g + -12 - e) | 0) >>> 0) / 12) | 0) * 12) | 0);
      Ns(e);
      u = w;
      return i | 0;
    }
    function gg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          i = d;
          f[i >> 2] = h[(c + e) >> 0];
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] = (h[i >> 0] | (h[(i + 1) >> 0] << 8)) & 255;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = d;
          f[j >> 2] = h[(c + e) >> 0];
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = d;
          f[j >> 2] =
            (h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)) &
            255;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function hg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 32) | 0;
      k = (p + 16) | 0;
      i = p;
      if ((j[(c + 38) >> 1] | 0) < 514) {
        o = (c + 8) | 0;
        n = f[(o + 4) >> 2] | 0;
        g = (c + 16) | 0;
        d = g;
        e = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        if (
          !(
            ((n | 0) > (d | 0)) |
            ((n | 0) == (d | 0) ? (f[o >> 2] | 0) >>> 0 > e >>> 0 : 0)
          )
        ) {
          a = 0;
          u = p;
          return a | 0;
        }
        o = b[((f[c >> 2] | 0) + e) >> 0] | 0;
        m = sq(e | 0, d | 0, 1, 0) | 0;
        n = g;
        f[n >> 2] = m;
        f[(n + 4) >> 2] = I;
        if (o << 24 >> 24) {
          a = 0;
          u = p;
          return a | 0;
        }
      }
      g = 0;
      do {
        _k(k, c) | 0;
        d = f[k >> 2] | 0;
        if (d | 0) {
          e = (a + 60 + ((g * 12) | 0)) | 0;
          jg(e, d, 0);
          is(i);
          lg(i, c) | 0;
          if (f[k >> 2] | 0) {
            d = 0;
            do {
              l = km(i) | 0;
              o = ((f[e >> 2] | 0) + (d >>> 5 << 2)) | 0;
              n = 1 << (d & 31);
              m = f[o >> 2] | 0;
              f[o >> 2] = l ? m | n : m & ~n;
              d = (d + 1) | 0;
            } while (d >>> 0 < (f[k >> 2] | 0) >>> 0);
          }
          Ss(i);
        }
        g = (g + 1) | 0;
      } while ((g | 0) < 4);
      m = (c + 8) | 0;
      l = f[m >> 2] | 0;
      m = f[(m + 4) >> 2] | 0;
      o = (c + 16) | 0;
      e = o;
      d = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      n = sq(d | 0, e | 0, 4, 0) | 0;
      g = I;
      if (((m | 0) < (g | 0)) | (((m | 0) == (g | 0)) & (l >>> 0 < n >>> 0))) {
        a = 0;
        u = p;
        return a | 0;
      }
      i = f[c >> 2] | 0;
      k = (i + d) | 0;
      k =
        h[k >> 0] |
        (h[(k + 1) >> 0] << 8) |
        (h[(k + 2) >> 0] << 16) |
        (h[(k + 3) >> 0] << 24);
      c = o;
      f[c >> 2] = n;
      f[(c + 4) >> 2] = g;
      d = sq(d | 0, e | 0, 8, 0) | 0;
      e = I;
      if (((m | 0) < (e | 0)) | (((m | 0) == (e | 0)) & (l >>> 0 < d >>> 0))) {
        a = 0;
        u = p;
        return a | 0;
      }
      c = (i + n) | 0;
      c =
        h[c >> 0] |
        (h[(c + 1) >> 0] << 8) |
        (h[(c + 2) >> 0] << 16) |
        (h[(c + 3) >> 0] << 24);
      f[o >> 2] = d;
      f[(o + 4) >> 2] = e;
      f[(a + 12) >> 2] = k;
      f[(a + 16) >> 2] = c;
      c = (c + (1 - k)) | 0;
      f[(a + 20) >> 2] = c;
      d = ((c | 0) / 2) | 0;
      e = (a + 24) | 0;
      f[e >> 2] = d;
      f[(a + 28) >> 2] = 0 - d;
      if ((c & 1) | 0) {
        a = 1;
        u = p;
        return a | 0;
      }
      f[e >> 2] = d + -1;
      a = 1;
      u = p;
      return a | 0;
    }
    function ig(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0;
      p = f[(a + 32) >> 2] | 0;
      q = f[(a + 36) >> 2] | 0;
      s = e >>> 0 > 1073741823 ? -1 : e << 2;
      r = Ks(s) | 0;
      Gk(r | 0, 0, s | 0) | 0;
      s = (a + 8) | 0;
      Hj(s, r, b, c);
      n = (a + 40) | 0;
      g = f[n >> 2] | 0;
      a = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      m = (a - d) | 0;
      o = m >> 2;
      if ((m | 0) <= 4) {
        Ls(r);
        return 1;
      }
      l = (p + 12) | 0;
      m = (e | 0) > 0;
      h = a;
      a = 1;
      while (1) {
        if ((h - d) >> 2 >>> 0 <= a >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        d = f[(d + (a << 2)) >> 2] | 0;
        k = X(a, e) | 0;
        if (
          (d | 0) >= 0
            ? ((t = f[((f[l >> 2] | 0) + (d << 2)) >> 2] | 0), (t | 0) >= 0)
            : 0
        ) {
          g = f[p >> 2] | 0;
          h = f[q >> 2] | 0;
          i = f[(h + (f[(g + (t << 2)) >> 2] << 2)) >> 2] | 0;
          d = (t + 1) | 0;
          d = (((d | 0) % 3) | 0 | 0) == 0 ? (t + -2) | 0 : d;
          if ((d | 0) < 0) d = -1073741824;
          else d = f[(g + (d << 2)) >> 2] | 0;
          j = f[(h + (d << 2)) >> 2] | 0;
          d = (((((t >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + t) | 0;
          if ((d | 0) < 0) d = -1073741824;
          else d = f[(g + (d << 2)) >> 2] | 0;
          d = f[(h + (d << 2)) >> 2] | 0;
          if (((i | 0) < (a | 0)) & ((j | 0) < (a | 0)) & ((d | 0) < (a | 0))) {
            i = X(i, e) | 0;
            h = X(j, e) | 0;
            g = X(d, e) | 0;
            if (m) {
              d = 0;
              do {
                f[(r + (d << 2)) >> 2] =
                  (f[(c + ((d + g) << 2)) >> 2] | 0) +
                  (f[(c + ((d + h) << 2)) >> 2] | 0) -
                  (f[(c + ((d + i) << 2)) >> 2] | 0);
                d = (d + 1) | 0;
              } while ((d | 0) != (e | 0));
            }
            Hj(s, r, (b + (k << 2)) | 0, (c + (k << 2)) | 0);
          } else u = 16;
        } else u = 16;
        if ((u | 0) == 16) {
          u = 0;
          Hj(
            s,
            (c + ((X((a + -1) | 0, e) | 0) << 2)) | 0,
            (b + (k << 2)) | 0,
            (c + (k << 2)) | 0
          );
        }
        a = (a + 1) | 0;
        if ((a | 0) >= (o | 0)) break;
        h = f[n >> 2] | 0;
        g = h;
        d = f[h >> 2] | 0;
        h = f[(h + 4) >> 2] | 0;
      }
      Ls(r);
      return 1;
    }
    function jg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = u;
      u = (u + 32) | 0;
      o = (p + 8) | 0;
      j = p;
      n = (a + 4) | 0;
      g = f[n >> 2] | 0;
      if (g >>> 0 >= b >>> 0) {
        f[n >> 2] = b;
        u = p;
        return;
      }
      m = (a + 8) | 0;
      e = f[m >> 2] | 0;
      l = e << 5;
      d = (b - g) | 0;
      if ((l >>> 0 < d >>> 0) | (g >>> 0 > ((l - d) | 0) >>> 0)) {
        f[o >> 2] = 0;
        l = (o + 4) | 0;
        f[l >> 2] = 0;
        k = (o + 8) | 0;
        f[k >> 2] = 0;
        if ((b | 0) < 0) {
          xr(a);
          e = f[m >> 2] | 0;
        }
        h = e << 6;
        b = (b + 31) & -32;
        Qj(
          o,
          e << 5 >>> 0 < 1073741823 ? (h >>> 0 < b >>> 0 ? b : h) : 2147483647
        );
        b = f[n >> 2] | 0;
        f[l >> 2] = b + d;
        e = f[a >> 2] | 0;
        h = e;
        g = f[o >> 2] | 0;
        b = (((h + (b >>> 5 << 2) - e) << 3) + (b & 31)) | 0;
        if ((b | 0) > 0) {
          i = b >>> 5;
          _n(g | 0, e | 0, (i << 2) | 0) | 0;
          e = (b - (i << 5)) | 0;
          b = (g + (i << 2)) | 0;
          g = b;
          if ((e | 0) > 0) {
            q = -1 >>> ((32 - e) | 0);
            f[b >> 2] = (f[b >> 2] & ~q) | (f[(h + (i << 2)) >> 2] & q);
          } else e = 0;
        } else e = 0;
        f[j >> 2] = g;
        f[(j + 4) >> 2] = e;
        b = j;
        e = f[b >> 2] | 0;
        b = f[(b + 4) >> 2] | 0;
        g = f[a >> 2] | 0;
        f[a >> 2] = f[o >> 2];
        f[o >> 2] = g;
        q = f[n >> 2] | 0;
        f[n >> 2] = f[l >> 2];
        f[l >> 2] = q;
        q = f[m >> 2] | 0;
        f[m >> 2] = f[k >> 2];
        f[k >> 2] = q;
        if (g | 0) Ns(g);
      } else {
        e = ((f[a >> 2] | 0) + (g >>> 5 << 2)) | 0;
        f[n >> 2] = b;
        b = g & 31;
      }
      if (!d) {
        u = p;
        return;
      }
      h = (b | 0) == 0;
      g = e;
      if (c) {
        if (!h) {
          e = (32 - b) | 0;
          q = e >>> 0 > d >>> 0 ? d : e;
          f[g >> 2] = f[g >> 2] | ((-1 >>> ((e - q) | 0)) & (-1 << b));
          g = (g + 4) | 0;
          e = g;
          d = (d - q) | 0;
        }
        q = d >>> 5;
        Gk(e | 0, -1, (q << 2) | 0) | 0;
        e = (d - (q << 5)) | 0;
        d = (g + (q << 2)) | 0;
        if (!e) {
          u = p;
          return;
        }
        f[d >> 2] = f[d >> 2] | (-1 >>> ((32 - e) | 0));
        u = p;
        return;
      } else {
        if (!h) {
          e = (32 - b) | 0;
          q = e >>> 0 > d >>> 0 ? d : e;
          f[g >> 2] = f[g >> 2] & ~((-1 >>> ((e - q) | 0)) & (-1 << b));
          g = (g + 4) | 0;
          e = g;
          d = (d - q) | 0;
        }
        q = d >>> 5;
        Gk(e | 0, 0, (q << 2) | 0) | 0;
        e = (d - (q << 5)) | 0;
        d = (g + (q << 2)) | 0;
        if (!e) {
          u = p;
          return;
        }
        f[d >> 2] = f[d >> 2] & ~(-1 >>> ((32 - e) | 0));
        u = p;
        return;
      }
    }
    function kg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = La,
        e = La,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        o = 0,
        p = La;
      l = f[b >> 2] | 0;
      j = (a + 4) | 0;
      i = f[j >> 2] | 0;
      k = (i | 0) == 0;
      a: do
        if (!k) {
          g = (i + -1) | 0;
          c = ((g & i) | 0) == 0;
          if (c) h = g & l;
          else h = ((l >>> 0) % (i >>> 0)) | 0;
          b = f[((f[a >> 2] | 0) + (h << 2)) >> 2] | 0;
          if (b)
            if (c) {
              do {
                b = f[b >> 2] | 0;
                if (!b) {
                  b = h;
                  break a;
                }
                if (((f[(b + 4) >> 2] & g) | 0) != (h | 0)) {
                  b = h;
                  break a;
                }
              } while ((f[(b + 8) >> 2] | 0) != (l | 0));
              a = (b + 12) | 0;
              return a | 0;
            } else {
              do {
                b = f[b >> 2] | 0;
                if (!b) {
                  b = h;
                  break a;
                }
                if (
                  ((((f[(b + 4) >> 2] | 0) >>> 0) % (i >>> 0)) | 0 | 0) !=
                  (h | 0)
                ) {
                  b = h;
                  break a;
                }
              } while ((f[(b + 8) >> 2] | 0) != (l | 0));
              a = (b + 12) | 0;
              return a | 0;
            }
          else b = h;
        } else b = 0;
      while (0);
      m = Xo(16) | 0;
      f[(m + 8) >> 2] = l;
      f[(m + 12) >> 2] = 0;
      f[(m + 4) >> 2] = l;
      f[m >> 2] = 0;
      h = (a + 12) | 0;
      e = $((((f[h >> 2] | 0) + 1) | 0) >>> 0);
      p = $(i >>> 0);
      d = $(n[(a + 16) >> 2]);
      do
        if (k | (e > $(p * d))) {
          b = (((i >>> 0 < 3) | ((((i + -1) & i) | 0) != 0)) & 1) | (i << 1);
          c = ~~$(W($(e / d))) >>> 0;
          Lj(a, b >>> 0 < c >>> 0 ? c : b);
          b = f[j >> 2] | 0;
          c = (b + -1) | 0;
          if (!(c & b)) {
            g = b;
            b = c & l;
            break;
          } else {
            g = b;
            b = ((l >>> 0) % (b >>> 0)) | 0;
            break;
          }
        } else g = i;
      while (0);
      c = ((f[a >> 2] | 0) + (b << 2)) | 0;
      b = f[c >> 2] | 0;
      if (!b) {
        b = (a + 8) | 0;
        f[m >> 2] = f[b >> 2];
        f[b >> 2] = m;
        f[c >> 2] = b;
        b = f[m >> 2] | 0;
        if (b | 0) {
          b = f[(b + 4) >> 2] | 0;
          c = (g + -1) | 0;
          if (!(c & g)) b = b & c;
          else b = ((b >>> 0) % (g >>> 0)) | 0;
          b = ((f[a >> 2] | 0) + (b << 2)) | 0;
          o = 24;
        }
      } else {
        f[m >> 2] = f[b >> 2];
        o = 24;
      }
      if ((o | 0) == 24) f[b >> 2] = m;
      f[h >> 2] = (f[h >> 2] | 0) + 1;
      a = m;
      a = (a + 12) | 0;
      return a | 0;
    }
    function lg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      q = u;
      u = (u + 16) | 0;
      m = q;
      e = (c + 8) | 0;
      l = e;
      i = f[(l + 4) >> 2] | 0;
      p = (c + 16) | 0;
      k = p;
      d = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      if (
        !(
          ((i | 0) > (k | 0)) |
          ((i | 0) == (k | 0) ? (f[l >> 2] | 0) >>> 0 > d >>> 0 : 0)
        )
      ) {
        a = 0;
        u = q;
        return a | 0;
      }
      b[(a + 12) >> 0] = b[((f[c >> 2] | 0) + d) >> 0] | 0;
      g = p;
      d = f[g >> 2] | 0;
      g = f[(g + 4) >> 2] | 0;
      i = sq(d | 0, g | 0, 1, 0) | 0;
      l = p;
      f[l >> 2] = i;
      f[(l + 4) >> 2] = I;
      if ((j[(c + 38) >> 1] | 0) < 514) {
        k = e;
        e = f[k >> 2] | 0;
        k = f[(k + 4) >> 2] | 0;
        d = sq(d | 0, g | 0, 5, 0) | 0;
        l = I;
        if (((k | 0) < (l | 0)) | (((k | 0) == (l | 0)) & (e >>> 0 < d >>> 0)))
          d = 0;
        else {
          i = ((f[c >> 2] | 0) + i) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          f[m >> 2] = i;
          g = p;
          f[g >> 2] = d;
          f[(g + 4) >> 2] = l;
          g = k;
          k = d;
          n = 7;
        }
      } else if (_k(m, c) | 0) {
        g = e;
        l = p;
        e = f[g >> 2] | 0;
        g = f[(g + 4) >> 2] | 0;
        k = f[l >> 2] | 0;
        l = f[(l + 4) >> 2] | 0;
        i = f[m >> 2] | 0;
        n = 7;
      } else d = 0;
      a: do
        if ((n | 0) == 7) {
          n = Ip(e | 0, g | 0, k | 0, l | 0) | 0;
          m = I;
          if (
            !((0 > (m | 0)) | ((0 == (m | 0)) & (i >>> 0 > n >>> 0)))
              ? ((o = ((f[c >> 2] | 0) + k) | 0), (i | 0) >= 1)
              : 0
          ) {
            f[a >> 2] = o;
            e = (i + -1) | 0;
            d = (o + e) | 0;
            switch (((h[d >> 0] | 0) >>> 6) & 3) {
              case 0: {
                f[(a + 4) >> 2] = e;
                d = b[d >> 0] & 63;
                break;
              }
              case 1: {
                if ((i | 0) < 2) {
                  d = 0;
                  break a;
                }
                f[(a + 4) >> 2] = i + -2;
                d = (o + i + -2) | 0;
                d = (((h[(d + 1) >> 0] | 0) << 8) & 16128) | (h[d >> 0] | 0);
                break;
              }
              case 2: {
                if ((i | 0) < 3) {
                  d = 0;
                  break a;
                }
                f[(a + 4) >> 2] = i + -3;
                d = (o + i + -3) | 0;
                d =
                  ((h[(d + 1) >> 0] | 0) << 8) |
                  (h[d >> 0] | 0) |
                  (((h[(d + 2) >> 0] | 0) << 16) & 4128768);
                break;
              }
              default: {
                d = 0;
                break a;
              }
            }
            o = (d + 4096) | 0;
            f[(a + 8) >> 2] = o;
            if (o >>> 0 <= 1048575) {
              a = sq(k | 0, l | 0, i | 0, 0) | 0;
              d = p;
              f[d >> 2] = a;
              f[(d + 4) >> 2] = I;
              d = 1;
            } else d = 0;
          } else d = 0;
        }
      while (0);
      a = d;
      u = q;
      return a | 0;
    }
    function mg(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0;
      p = f[(a + 32) >> 2] | 0;
      q = f[(a + 36) >> 2] | 0;
      s = e >>> 0 > 1073741823 ? -1 : e << 2;
      r = Ks(s) | 0;
      Gk(r | 0, 0, s | 0) | 0;
      s = (a + 8) | 0;
      Kj(s, r, b, c);
      n = (a + 40) | 0;
      g = f[n >> 2] | 0;
      a = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      m = (a - d) | 0;
      o = m >> 2;
      if ((m | 0) <= 4) {
        Ls(r);
        return 1;
      }
      l = (p + 12) | 0;
      m = (e | 0) > 0;
      h = a;
      a = 1;
      while (1) {
        if ((h - d) >> 2 >>> 0 <= a >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        d = f[(d + (a << 2)) >> 2] | 0;
        k = X(a, e) | 0;
        if (
          (d | 0) >= 0
            ? ((t = f[((f[l >> 2] | 0) + (d << 2)) >> 2] | 0), (t | 0) >= 0)
            : 0
        ) {
          g = f[p >> 2] | 0;
          h = f[q >> 2] | 0;
          i = f[(h + (f[(g + (t << 2)) >> 2] << 2)) >> 2] | 0;
          d = (t + 1) | 0;
          d = (((d | 0) % 3) | 0 | 0) == 0 ? (t + -2) | 0 : d;
          if ((d | 0) < 0) d = -1073741824;
          else d = f[(g + (d << 2)) >> 2] | 0;
          j = f[(h + (d << 2)) >> 2] | 0;
          d = (((((t >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + t) | 0;
          if ((d | 0) < 0) d = -1073741824;
          else d = f[(g + (d << 2)) >> 2] | 0;
          d = f[(h + (d << 2)) >> 2] | 0;
          if (((i | 0) < (a | 0)) & ((j | 0) < (a | 0)) & ((d | 0) < (a | 0))) {
            i = X(i, e) | 0;
            h = X(j, e) | 0;
            g = X(d, e) | 0;
            if (m) {
              d = 0;
              do {
                f[(r + (d << 2)) >> 2] =
                  (f[(c + ((d + g) << 2)) >> 2] | 0) +
                  (f[(c + ((d + h) << 2)) >> 2] | 0) -
                  (f[(c + ((d + i) << 2)) >> 2] | 0);
                d = (d + 1) | 0;
              } while ((d | 0) != (e | 0));
            }
            Kj(s, r, (b + (k << 2)) | 0, (c + (k << 2)) | 0);
          } else u = 16;
        } else u = 16;
        if ((u | 0) == 16) {
          u = 0;
          Kj(
            s,
            (c + ((X((a + -1) | 0, e) | 0) << 2)) | 0,
            (b + (k << 2)) | 0,
            (c + (k << 2)) | 0
          );
        }
        a = (a + 1) | 0;
        if ((a | 0) >= (o | 0)) break;
        h = f[n >> 2] | 0;
        g = h;
        d = f[h >> 2] | 0;
        h = f[(h + 4) >> 2] | 0;
      }
      Ls(r);
      return 1;
    }
    function ng(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 16) | 0;
      m = p;
      k = Sa[f[((f[a >> 2] | 0) + 24) >> 2] & 255](a) | 0;
      if ((k | 0) <= 0) {
        a = 1;
        o = 1;
        o = a | o;
        u = p;
        return o | 0;
      }
      j = (a + 36) | 0;
      l = (a + 48) | 0;
      b = 0;
      while (1) {
        i = ((Sa[f[((f[a >> 2] | 0) + 28) >> 2] & 255](a) | 0) + 40) | 0;
        if (f[i >> 2] | 0) {
          h = f[((f[((f[j >> 2] | 0) + (b << 2)) >> 2] | 0) + 8) >> 2] | 0;
          g = ((Sa[f[((f[a >> 2] | 0) + 28) >> 2] & 255](a) | 0) + 40) | 0;
          g = f[g >> 2] | 0;
          h = f[(h + 56) >> 2] | 0;
          f[m >> 2] = 0;
          f[(m + 4) >> 2] = 0;
          f[(m + 8) >> 2] = 0;
          ql(m, 20122, 24);
          i = (g + 16) | 0;
          d = f[i >> 2] | 0;
          if (d) {
            c = i;
            e = d;
            a: while (1) {
              d = e;
              while (1) {
                if ((f[(d + 16) >> 2] | 0) >= (h | 0)) break;
                d = f[(d + 4) >> 2] | 0;
                if (!d) break a;
              }
              e = f[d >> 2] | 0;
              if (!e) {
                c = d;
                break;
              } else c = d;
            }
            if (
              ((c | 0) != (i | 0)
              ? ((n = (c + 20) | 0), (h | 0) >= (f[(c + 16) >> 2] | 0))
              : 0)
                ? (uj(n, m) | 0) != 0
                : 0
            )
              c = xl(n, m, 0) | 0;
            else o = 13;
          } else o = 13;
          if ((o | 0) == 13) {
            o = 0;
            c = xl(g, m, 0) | 0;
          }
          wq(m);
          if (c) {
            o = 15;
            break;
          }
        }
        i = f[((f[j >> 2] | 0) + (b << 2)) >> 2] | 0;
        if (!(Wa[f[((f[i >> 2] | 0) + 24) >> 2] & 127](i, l) | 0)) {
          b = 0;
          c = 0;
          o = 18;
          break;
        }
        b = (b + 1) | 0;
        if ((b | 0) >= (k | 0)) {
          b = 1;
          c = 1;
          o = 18;
          break;
        }
      }
      if ((o | 0) == 15) {
        a = f[((f[j >> 2] | 0) + (b << 2)) >> 2] | 0;
        o = f[(a + 8) >> 2] | 0;
        Ig(o, zi(a) | 0);
        a = 0;
        o = 1;
        o = a | o;
        u = p;
        return o | 0;
      } else if ((o | 0) == 18) {
        o = b | c;
        u = p;
        return o | 0;
      }
      return 0;
    }
    function og(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0;
      p = f[(a + 32) >> 2] | 0;
      q = f[(a + 36) >> 2] | 0;
      s = e >>> 0 > 1073741823 ? -1 : e << 2;
      r = Ks(s) | 0;
      Gk(r | 0, 0, s | 0) | 0;
      s = (a + 8) | 0;
      Hj(s, r, b, c);
      n = (a + 40) | 0;
      g = f[n >> 2] | 0;
      a = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      m = (a - d) | 0;
      o = m >> 2;
      if ((m | 0) <= 4) {
        Ls(r);
        return 1;
      }
      m = (p + 64) | 0;
      k = (p + 28) | 0;
      l = (e | 0) > 0;
      h = a;
      a = 1;
      while (1) {
        if ((h - d) >> 2 >>> 0 <= a >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        d = f[(d + (a << 2)) >> 2] | 0;
        j = X(a, e) | 0;
        if (
          (!((d | 0) < 0
            ? 1
            : (((1 << (d & 31)) & f[((f[p >> 2] | 0) + (d >>> 5 << 2)) >> 2]) |
                0) !=
                0)
          ? (
              (w =
                f[((f[((f[m >> 2] | 0) + 12) >> 2] | 0) + (d << 2)) >> 2] | 0),
              (w | 0) >= 0
            )
          : 0)
            ? (
                (v = f[k >> 2] | 0),
                (i = f[q >> 2] | 0),
                (t = f[(i + (f[(v + (w << 2)) >> 2] << 2)) >> 2] | 0),
                (u = (w + 1) | 0),
                (u =
                  f[
                    (i +
                      (f[
                        (v +
                          (((((u | 0) % 3) | 0 | 0) == 0 ? (w + -2) | 0 : u) <<
                            2)) >>
                          2
                      ] <<
                        2)) >>
                      2
                  ] | 0),
                (v =
                  f[
                    (i +
                      (f[
                        (v +
                          ((((((w >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + w) <<
                            2)) >>
                          2
                      ] <<
                        2)) >>
                      2
                  ] | 0),
                ((t | 0) < (a | 0)) & ((u | 0) < (a | 0)) & ((v | 0) < (a | 0))
              )
            : 0
        ) {
          g = X(t, e) | 0;
          h = X(u, e) | 0;
          i = X(v, e) | 0;
          if (l) {
            d = 0;
            do {
              f[(r + (d << 2)) >> 2] =
                (f[(c + ((d + i) << 2)) >> 2] | 0) +
                (f[(c + ((d + h) << 2)) >> 2] | 0) -
                (f[(c + ((d + g) << 2)) >> 2] | 0);
              d = (d + 1) | 0;
            } while ((d | 0) != (e | 0));
          }
          Hj(s, r, (b + (j << 2)) | 0, (c + (j << 2)) | 0);
        } else
          Hj(
            s,
            (c + ((X((a + -1) | 0, e) | 0) << 2)) | 0,
            (b + (j << 2)) | 0,
            (c + (j << 2)) | 0
          );
        a = (a + 1) | 0;
        if ((a | 0) >= (o | 0)) break;
        h = f[n >> 2] | 0;
        g = h;
        d = f[h >> 2] | 0;
        h = f[(h + 4) >> 2] | 0;
      }
      Ls(r);
      return 1;
    }
    function pg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = b[(c + e) >> 0];
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            ((h[j >> 0] | (h[(j + 1) >> 0] << 8)) & 65535) << 24 >> 24;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          f[d >> 2] = b[(c + e) >> 0];
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) <<
            24 >>
            24;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function qg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          c = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                c | 0,
                (((c | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            !(
              ((g | 0) < 0) |
              ((g | 0) == 0
                ? e >>> 0 < (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
                : 0)
            )
          ) {
            i = 0;
            return i | 0;
          }
          f[d >> 2] = h[(c + e) >> 0];
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 2, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] = (h[j >> 0] | (h[(j + 1) >> 0] << 8)) & 255;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 3, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          f[d >> 2] = h[(c + e) >> 0];
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 4, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          f[d >> 2] =
            (h[j >> 0] |
              (h[(j + 1) >> 0] << 8) |
              (h[(j + 2) >> 0] << 16) |
              (h[(j + 3) >> 0] << 24)) &
            255;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function rg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0;
      i = (c | 0) == (a | 0);
      b[(c + 12) >> 0] = i & 1;
      if (i) return;
      while (1) {
        h = f[(c + 8) >> 2] | 0;
        g = (h + 12) | 0;
        if (b[g >> 0] | 0) {
          e = 23;
          break;
        }
        i = (h + 8) | 0;
        d = f[i >> 2] | 0;
        e = f[d >> 2] | 0;
        if ((e | 0) == (h | 0)) {
          e = f[(d + 4) >> 2] | 0;
          if (!e) {
            e = 7;
            break;
          }
          e = (e + 12) | 0;
          if (!(b[e >> 0] | 0)) c = e;
          else {
            e = 7;
            break;
          }
        } else {
          if (!e) {
            e = 16;
            break;
          }
          e = (e + 12) | 0;
          if (!(b[e >> 0] | 0)) c = e;
          else {
            e = 16;
            break;
          }
        }
        b[g >> 0] = 1;
        i = (d | 0) == (a | 0);
        b[(d + 12) >> 0] = i & 1;
        b[c >> 0] = 1;
        if (i) {
          e = 23;
          break;
        } else c = d;
      }
      if ((e | 0) == 7) {
        if ((f[h >> 2] | 0) == (c | 0)) c = h;
        else {
          a = (h + 4) | 0;
          c = f[a >> 2] | 0;
          e = f[c >> 2] | 0;
          f[a >> 2] = e;
          if (e) {
            f[(e + 8) >> 2] = h;
            d = f[i >> 2] | 0;
          }
          a = (c + 8) | 0;
          f[a >> 2] = d;
          d = f[i >> 2] | 0;
          f[((f[d >> 2] | 0) == (h | 0) ? d : (d + 4) | 0) >> 2] = c;
          f[c >> 2] = h;
          f[i >> 2] = c;
          d = f[a >> 2] | 0;
        }
        b[(c + 12) >> 0] = 1;
        b[(d + 12) >> 0] = 0;
        c = f[d >> 2] | 0;
        g = (c + 4) | 0;
        e = f[g >> 2] | 0;
        f[d >> 2] = e;
        if (e | 0) f[(e + 8) >> 2] = d;
        i = (d + 8) | 0;
        f[(c + 8) >> 2] = f[i >> 2];
        h = f[i >> 2] | 0;
        f[((f[h >> 2] | 0) == (d | 0) ? h : (h + 4) | 0) >> 2] = c;
        f[g >> 2] = d;
        f[i >> 2] = c;
        return;
      } else if ((e | 0) == 16) {
        if ((f[h >> 2] | 0) == (c | 0)) {
          c = f[h >> 2] | 0;
          g = (c + 4) | 0;
          e = f[g >> 2] | 0;
          f[h >> 2] = e;
          if (e) {
            f[(e + 8) >> 2] = h;
            d = f[i >> 2] | 0;
          }
          e = (c + 8) | 0;
          f[e >> 2] = d;
          a = f[i >> 2] | 0;
          f[((f[a >> 2] | 0) == (h | 0) ? a : (a + 4) | 0) >> 2] = c;
          f[g >> 2] = h;
          f[i >> 2] = c;
          e = f[e >> 2] | 0;
        } else {
          c = h;
          e = d;
        }
        b[(c + 12) >> 0] = 1;
        b[(e + 12) >> 0] = 0;
        i = (e + 4) | 0;
        c = f[i >> 2] | 0;
        d = f[c >> 2] | 0;
        f[i >> 2] = d;
        if (d | 0) f[(d + 8) >> 2] = e;
        i = (e + 8) | 0;
        f[(c + 8) >> 2] = f[i >> 2];
        h = f[i >> 2] | 0;
        f[((f[h >> 2] | 0) == (e | 0) ? h : (h + 4) | 0) >> 2] = c;
        f[c >> 2] = e;
        f[i >> 2] = c;
        return;
      } else if ((e | 0) == 23) return;
    }
    function sg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 4) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 32) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 52) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 72) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      hb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function tg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 4) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 32) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 52) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 72) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      fb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function ug(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 4) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(lg((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 28) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 48) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 68) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      ub(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function vg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 4) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(lg((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 28) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 48) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 68) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      f[m >> 2] = f[d >> 2];
      f[n >> 2] = f[m >> 2];
      tb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function wg(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        u = 0,
        v = 0,
        w = 0;
      p = f[(a + 32) >> 2] | 0;
      q = f[(a + 36) >> 2] | 0;
      s = e >>> 0 > 1073741823 ? -1 : e << 2;
      r = Ks(s) | 0;
      Gk(r | 0, 0, s | 0) | 0;
      s = (a + 8) | 0;
      Kj(s, r, b, c);
      n = (a + 40) | 0;
      g = f[n >> 2] | 0;
      a = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      m = (a - d) | 0;
      o = m >> 2;
      if ((m | 0) <= 4) {
        Ls(r);
        return 1;
      }
      m = (p + 64) | 0;
      k = (p + 28) | 0;
      l = (e | 0) > 0;
      h = a;
      a = 1;
      while (1) {
        if ((h - d) >> 2 >>> 0 <= a >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        d = f[(d + (a << 2)) >> 2] | 0;
        j = X(a, e) | 0;
        if (
          (!((d | 0) < 0
            ? 1
            : (((1 << (d & 31)) & f[((f[p >> 2] | 0) + (d >>> 5 << 2)) >> 2]) |
                0) !=
                0)
          ? (
              (w =
                f[((f[((f[m >> 2] | 0) + 12) >> 2] | 0) + (d << 2)) >> 2] | 0),
              (w | 0) >= 0
            )
          : 0)
            ? (
                (v = f[k >> 2] | 0),
                (i = f[q >> 2] | 0),
                (t = f[(i + (f[(v + (w << 2)) >> 2] << 2)) >> 2] | 0),
                (u = (w + 1) | 0),
                (u =
                  f[
                    (i +
                      (f[
                        (v +
                          (((((u | 0) % 3) | 0 | 0) == 0 ? (w + -2) | 0 : u) <<
                            2)) >>
                          2
                      ] <<
                        2)) >>
                      2
                  ] | 0),
                (v =
                  f[
                    (i +
                      (f[
                        (v +
                          ((((((w >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + w) <<
                            2)) >>
                          2
                      ] <<
                        2)) >>
                      2
                  ] | 0),
                ((t | 0) < (a | 0)) & ((u | 0) < (a | 0)) & ((v | 0) < (a | 0))
              )
            : 0
        ) {
          g = X(t, e) | 0;
          h = X(u, e) | 0;
          i = X(v, e) | 0;
          if (l) {
            d = 0;
            do {
              f[(r + (d << 2)) >> 2] =
                (f[(c + ((d + i) << 2)) >> 2] | 0) +
                (f[(c + ((d + h) << 2)) >> 2] | 0) -
                (f[(c + ((d + g) << 2)) >> 2] | 0);
              d = (d + 1) | 0;
            } while ((d | 0) != (e | 0));
          }
          Kj(s, r, (b + (j << 2)) | 0, (c + (j << 2)) | 0);
        } else
          Kj(
            s,
            (c + ((X((a + -1) | 0, e) | 0) << 2)) | 0,
            (b + (j << 2)) | 0,
            (c + (j << 2)) | 0
          );
        a = (a + 1) | 0;
        if ((a | 0) >= (o | 0)) break;
        h = f[n >> 2] | 0;
        g = h;
        d = f[h >> 2] | 0;
        h = f[(h + 4) >> 2] | 0;
      }
      Ls(r);
      return 1;
    }
    function xg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0;
      q = u;
      u = (u + 16) | 0;
      p = q;
      i = (b + 8) | 0;
      g = i;
      j = f[g >> 2] | 0;
      g = f[(g + 4) >> 2] | 0;
      o = (b + 16) | 0;
      d = o;
      c = f[d >> 2] | 0;
      d = sq(c | 0, f[(d + 4) >> 2] | 0, 4, 0) | 0;
      e = I;
      if (((g | 0) < (e | 0)) | (((g | 0) == (e | 0)) & (j >>> 0 < d >>> 0))) {
        p = 0;
        u = q;
        return p | 0;
      }
      g = ((f[b >> 2] | 0) + c) | 0;
      g =
        h[g >> 0] |
        (h[(g + 1) >> 0] << 8) |
        (h[(g + 2) >> 0] << 16) |
        (h[(g + 3) >> 0] << 24);
      j = o;
      f[j >> 2] = d;
      f[(j + 4) >> 2] = e;
      if ((g | 0) < 0) {
        p = 0;
        u = q;
        return p | 0;
      }
      jg((a + 76) | 0, g, 0);
      is(p);
      if (lg(p, b) | 0) {
        if ((g | 0) > 0) {
          c = (a + 76) | 0;
          d = 0;
          e = 1;
          do {
            e = e ^ ((km(p) | 0) ^ 1);
            j = ((f[c >> 2] | 0) + (d >>> 5 << 2)) | 0;
            r = 1 << (d & 31);
            s = f[j >> 2] | 0;
            f[j >> 2] = e ? s | r : s & ~r;
            d = (d + 1) | 0;
          } while ((d | 0) < (g | 0));
        }
        d = i;
        c = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        g = o;
        e = f[g >> 2] | 0;
        g = f[(g + 4) >> 2] | 0;
        i = sq(e | 0, g | 0, 4, 0) | 0;
        j = I;
        if (
          !(((d | 0) < (j | 0)) | (((d | 0) == (j | 0)) & (c >>> 0 < i >>> 0)))
            ? (
                (k = f[b >> 2] | 0),
                (l = (k + e) | 0),
                (l =
                  h[l >> 0] |
                  (h[(l + 1) >> 0] << 8) |
                  (h[(l + 2) >> 0] << 16) |
                  (h[(l + 3) >> 0] << 24)),
                (m = o),
                (f[m >> 2] = i),
                (f[(m + 4) >> 2] = j),
                (m = sq(e | 0, g | 0, 8, 0) | 0),
                (n = I),
                !(
                  ((d | 0) < (n | 0)) |
                  (((d | 0) == (n | 0)) & (c >>> 0 < m >>> 0))
                )
              )
            : 0
        ) {
          s = (k + i) | 0;
          s =
            h[s >> 0] |
            (h[(s + 1) >> 0] << 8) |
            (h[(s + 2) >> 0] << 16) |
            (h[(s + 3) >> 0] << 24);
          c = o;
          f[c >> 2] = m;
          f[(c + 4) >> 2] = n;
          f[(a + 12) >> 2] = l;
          f[(a + 16) >> 2] = s;
          s = (s + (1 - l)) | 0;
          f[(a + 20) >> 2] = s;
          c = ((s | 0) / 2) | 0;
          d = (a + 24) | 0;
          f[d >> 2] = c;
          f[(a + 28) >> 2] = 0 - c;
          if (!(s & 1)) {
            f[d >> 2] = c + -1;
            c = 1;
          } else c = 1;
        } else c = 0;
      } else c = 0;
      Ss(p);
      s = c;
      u = q;
      return s | 0;
    }
    function yg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 8) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 32) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 52) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 72) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      c = d;
      d = f[(c + 4) >> 2] | 0;
      p = m;
      f[p >> 2] = f[c >> 2];
      f[(p + 4) >> 2] = d;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      gb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function zg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 8) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 32) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 52) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 72) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      c = d;
      d = f[(c + 4) >> 2] | 0;
      p = m;
      f[p >> 2] = f[c >> 2];
      f[(p + 4) >> 2] = d;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      eb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function Ag(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 8) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(lg((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 28) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 48) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 68) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      c = d;
      d = f[(c + 4) >> 2] | 0;
      p = m;
      f[p >> 2] = f[c >> 2];
      f[(p + 4) >> 2] = d;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      sb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function Bg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      o = u;
      u = (u + 16) | 0;
      n = (o + 8) | 0;
      m = o;
      i = (c + 8) | 0;
      k = i;
      e = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (c + 16) | 0;
      j = l;
      g = f[j >> 2] | 0;
      j = f[(j + 4) >> 2] | 0;
      p = sq(g | 0, j | 0, 4, 0) | 0;
      q = I;
      if (((k | 0) < (q | 0)) | (((k | 0) == (q | 0)) & (e >>> 0 < p >>> 0)))
        i = k;
      else {
        g = ((f[c >> 2] | 0) + g) | 0;
        g =
          h[g >> 0] |
          (h[(g + 1) >> 0] << 8) |
          (h[(g + 2) >> 0] << 16) |
          (h[(g + 3) >> 0] << 24);
        b[a >> 0] = g;
        b[(a + 1) >> 0] = g >> 8;
        b[(a + 2) >> 0] = g >> 16;
        b[(a + 3) >> 0] = g >> 24;
        g = l;
        g = sq(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
        j = I;
        e = l;
        f[e >> 2] = g;
        f[(e + 4) >> 2] = j;
        e = i;
        i = f[(e + 4) >> 2] | 0;
        e = f[e >> 2] | 0;
      }
      k = (a + 4) | 0;
      q = sq(g | 0, j | 0, 4, 0) | 0;
      p = I;
      if (((i | 0) < (p | 0)) | (((i | 0) == (p | 0)) & (e >>> 0 < q >>> 0)))
        e = f[k >> 2] | 0;
      else {
        e = ((f[c >> 2] | 0) + g) | 0;
        e =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[k >> 0] = e;
        b[(k + 1) >> 0] = e >> 8;
        b[(k + 2) >> 0] = e >> 16;
        b[(k + 3) >> 0] = e >> 24;
        p = l;
        p = sq(f[p >> 2] | 0, f[(p + 4) >> 2] | 0, 4, 0) | 0;
        q = l;
        f[q >> 2] = p;
        f[(q + 4) >> 2] = I;
      }
      if (!e) {
        q = 1;
        u = o;
        return q | 0;
      }
      if (!(lg((a + 12) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 28) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 48) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      if (!(mh((a + 68) | 0, c) | 0)) {
        q = 0;
        u = o;
        return q | 0;
      }
      q = f[k >> 2] | 0;
      c = d;
      d = f[(c + 4) >> 2] | 0;
      p = m;
      f[p >> 2] = f[c >> 2];
      f[(p + 4) >> 2] = d;
      f[n >> 2] = f[m >> 2];
      f[(n + 4) >> 2] = f[(m + 4) >> 2];
      rb(a, q, n);
      q = 1;
      u = o;
      return q | 0;
    }
    function Cg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      m = u;
      u = (u + 16) | 0;
      k = m;
      if (!(uc(a, c) | 0)) {
        a = 0;
        u = m;
        return a | 0;
      }
      j = Sa[f[((f[a >> 2] | 0) + 24) >> 2] & 255](a) | 0;
      l = (a + 36) | 0;
      h = (a + 40) | 0;
      d = f[h >> 2] | 0;
      e = f[l >> 2] | 0;
      g = (d - e) >> 2;
      if (j >>> 0 <= g >>> 0) {
        if (
          j >>> 0 < g >>> 0 ? ((i = (e + (j << 2)) | 0), (d | 0) != (i | 0)) : 0
        )
          do {
            g = (d + -4) | 0;
            f[h >> 2] = g;
            d = f[g >> 2] | 0;
            f[g >> 2] = 0;
            if (d | 0) Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
            d = f[h >> 2] | 0;
          } while ((d | 0) != (i | 0));
      } else Jh(l, (j - g) | 0);
      g = (c + 8) | 0;
      if ((j | 0) <= 0) {
        a = 1;
        u = m;
        return a | 0;
      }
      i = (c + 16) | 0;
      h = 0;
      while (1) {
        n = g;
        o = f[(n + 4) >> 2] | 0;
        e = i;
        d = f[e >> 2] | 0;
        e = f[(e + 4) >> 2] | 0;
        if (
          !(
            ((o | 0) > (e | 0)) |
            ((o | 0) == (e | 0) ? (f[n >> 2] | 0) >>> 0 > d >>> 0 : 0)
          )
        ) {
          d = 0;
          e = 19;
          break;
        }
        o = b[((f[c >> 2] | 0) + d) >> 0] | 0;
        d = sq(d | 0, e | 0, 1, 0) | 0;
        n = i;
        f[n >> 2] = d;
        f[(n + 4) >> 2] = I;
        Ta[f[((f[a >> 2] | 0) + 48) >> 2] & 15](k, a, o);
        o = ((f[l >> 2] | 0) + (h << 2)) | 0;
        n = f[k >> 2] | 0;
        f[k >> 2] = 0;
        d = f[o >> 2] | 0;
        f[o >> 2] = n;
        if (d | 0) Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
        d = f[k >> 2] | 0;
        f[k >> 2] = 0;
        if (d | 0) Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
        d = f[((f[l >> 2] | 0) + (h << 2)) >> 2] | 0;
        if (!d) {
          d = 0;
          e = 19;
          break;
        }
        e = f[((f[d >> 2] | 0) + 8) >> 2] | 0;
        n = Sa[f[((f[a >> 2] | 0) + 28) >> 2] & 255](a) | 0;
        o = Wa[f[((f[a >> 2] | 0) + 20) >> 2] & 127](a, h) | 0;
        h = (h + 1) | 0;
        if (!(Na[e & 31](d, n, o) | 0)) {
          d = 0;
          e = 19;
          break;
        }
        if ((h | 0) >= (j | 0)) {
          d = 1;
          e = 19;
          break;
        }
      }
      if ((e | 0) == 19) {
        u = m;
        return d | 0;
      }
      return 0;
    }
    function Dg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      l = u;
      u = (u + 16) | 0;
      h = l;
      c = (a + 40) | 0;
      d = c;
      e = a;
      g = (d + 40) | 0;
      do {
        f[d >> 2] = f[e >> 2];
        d = (d + 4) | 0;
        e = (e + 4) | 0;
      } while ((d | 0) < (g | 0));
      if (hi(c, 1, h) | 0) {
        d = a;
        e = c;
        g = (d + 40) | 0;
        do {
          f[d >> 2] = f[e >> 2];
          d = (d + 4) | 0;
          e = (e + 4) | 0;
        } while ((d | 0) < (g | 0));
        g = h;
        e = f[g >> 2] | 0;
        g = f[(g + 4) >> 2] | 0;
        i = (a + 8) | 0;
        m = i;
        k = (a + 16) | 0;
        d = k;
        c = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        m = Ip(f[m >> 2] | 0, f[(m + 4) >> 2] | 0, c | 0, d | 0) | 0;
        n = I;
        if (
          !((g >>> 0 > n >>> 0) | (((g | 0) == (n | 0)) & (e >>> 0 > m >>> 0)))
        ) {
          m = sq(c | 0, d | 0, e | 0, g | 0) | 0;
          n = k;
          f[n >> 2] = m;
          f[(n + 4) >> 2] = I;
          do
            if ((j[(a + 38) >> 1] | 0) < 514) {
              c = (a + 96) | 0;
              d = c;
              e = a;
              g = (d + 40) | 0;
              do {
                f[d >> 2] = f[e >> 2];
                d = (d + 4) | 0;
                e = (e + 4) | 0;
              } while ((d | 0) < (g | 0));
              if (hi(c, 1, h) | 0) {
                d = a;
                e = c;
                g = (d + 40) | 0;
                do {
                  f[d >> 2] = f[e >> 2];
                  d = (d + 4) | 0;
                  e = (e + 4) | 0;
                } while ((d | 0) < (g | 0));
                g = h;
                e = f[g >> 2] | 0;
                g = f[(g + 4) >> 2] | 0;
                n = i;
                d = k;
                c = f[d >> 2] | 0;
                d = f[(d + 4) >> 2] | 0;
                n = Ip(f[n >> 2] | 0, f[(n + 4) >> 2] | 0, c | 0, d | 0) | 0;
                m = I;
                if (
                  !(
                    (g >>> 0 > m >>> 0) |
                    (((g | 0) == (m | 0)) & (e >>> 0 > n >>> 0))
                  )
                ) {
                  m = sq(c | 0, d | 0, e | 0, g | 0) | 0;
                  n = k;
                  f[n >> 2] = m;
                  f[(n + 4) >> 2] = I;
                  break;
                }
              }
              n = 0;
              u = l;
              return n | 0;
            } else lg((a + 80) | 0, a) | 0;
          while (0);
          if (!(bk(a) | 0)) {
            n = 0;
            u = l;
            return n | 0;
          }
          d = b;
          e = a;
          g = (d + 40) | 0;
          do {
            f[d >> 2] = f[e >> 2];
            d = (d + 4) | 0;
            e = (e + 4) | 0;
          } while ((d | 0) < (g | 0));
          n = 1;
          u = l;
          return n | 0;
        }
      }
      n = 0;
      u = l;
      return n | 0;
    }
    function Eg(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = u;
      u = (u + 144) | 0;
      i = (n + 136) | 0;
      m = (n + 32) | 0;
      l = n;
      e = f[((f[(c + 4) >> 2] | 0) + 44) >> 2] | 0;
      h = Xo(124) | 0;
      f[(h + 4) >> 2] = 0;
      f[h >> 2] = 4676;
      f[(h + 12) >> 2] = 4700;
      f[(h + 100) >> 2] = 0;
      f[(h + 104) >> 2] = 0;
      f[(h + 108) >> 2] = 0;
      j = (h + 16) | 0;
      k = (j + 80) | 0;
      do {
        f[j >> 2] = 0;
        j = (j + 4) | 0;
      } while ((j | 0) < (k | 0));
      f[(h + 112) >> 2] = e;
      f[(h + 116) >> 2] = d;
      f[(h + 120) >> 2] = 0;
      g = h;
      f[(m + 4) >> 2] = 4700;
      f[(m + 92) >> 2] = 0;
      f[(m + 96) >> 2] = 0;
      f[(m + 100) >> 2] = 0;
      j = (m + 8) | 0;
      k = (j + 80) | 0;
      do {
        f[j >> 2] = 0;
        j = (j + 4) | 0;
      } while ((j | 0) < (k | 0));
      k = f[(c + 8) >> 2] | 0;
      f[l >> 2] = 4700;
      j = (l + 4) | 0;
      c = (j + 4) | 0;
      f[c >> 2] = 0;
      f[(c + 4) >> 2] = 0;
      f[(c + 8) >> 2] = 0;
      f[(c + 12) >> 2] = 0;
      f[(c + 16) >> 2] = 0;
      f[(c + 20) >> 2] = 0;
      c = k;
      f[j >> 2] = c;
      c = ((((f[(c + 4) >> 2] | 0) - (f[k >> 2] | 0)) >> 2 >>> 0) / 3) | 0;
      b[i >> 0] = 0;
      xi((l + 8) | 0, c, i);
      Pa[f[((f[l >> 2] | 0) + 8) >> 2] & 255](l);
      f[m >> 2] = f[j >> 2];
      Oh((m + 4) | 0, l) | 0;
      f[(m + 36) >> 2] = k;
      f[(m + 40) >> 2] = d;
      f[(m + 44) >> 2] = e;
      f[(m + 48) >> 2] = h;
      Rh(h, m);
      f[a >> 2] = g;
      f[l >> 2] = 4700;
      e = f[(l + 20) >> 2] | 0;
      if (e | 0) Ns(e);
      e = f[(l + 8) >> 2] | 0;
      if (!e) {
        fk(m);
        u = n;
        return;
      }
      Ns(e);
      fk(m);
      u = n;
      return;
    }
    function Fg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0;
      v = u;
      u = (u + 16) | 0;
      q = (v + 4) | 0;
      r = v;
      d = f[b >> 2] | 0;
      f[q >> 2] = d;
      n = (a + 8) | 0;
      c = (d | 0) < 0;
      b = (d + 1) | 0;
      do
        if (!c) {
          f[(q + 4) >> 2] = (((b | 0) % 3) | 0 | 0) == 0 ? (d + -2) | 0 : b;
          if (!(((d >>> 0) % 3) | 0)) {
            b = (d + 2) | 0;
            break;
          } else {
            b = (d + -1) | 0;
            break;
          }
        } else {
          f[(q + 4) >> 2] = d;
          b = d;
        }
      while (0);
      f[(q + 8) >> 2] = b;
      m = c ? -1073741824 : ((d >>> 0) / 3) | 0;
      l = (a + 224) | 0;
      k = (a + 228) | 0;
      j = (a + 376) | 0;
      b = 0;
      while (1) {
        if (
          (d | 0) >= 0
            ? (
                (s =
                  f[((f[((f[n >> 2] | 0) + 12) >> 2] | 0) + (d << 2)) >> 2] |
                  0),
                (s | 0) >= 0
              )
            : 0
        ) {
          if (
            (((s >>> 0) / 3) | 0 | 0) >= (m | 0)
              ? (f[k >> 2] | 0) != (f[l >> 2] | 0)
              : 0
          ) {
            g = 0;
            do {
              if (km(((f[j >> 2] | 0) + (g << 4)) | 0) | 0) {
                c = f[l >> 2] | 0;
                f[r >> 2] = d;
                e = (c + ((g * 116) | 0) + 108) | 0;
                a = f[e >> 2] | 0;
                if (a >>> 0 < (f[(c + ((g * 116) | 0) + 112) >> 2] | 0) >>> 0) {
                  f[a >> 2] = d;
                  f[e >> 2] = a + 4;
                } else hk((c + ((g * 116) | 0) + 104) | 0, r);
              }
              g = (g + 1) | 0;
            } while (
              g >>> 0 <
              (((((f[k >> 2] | 0) - (f[l >> 2] | 0)) | 0) / 116) | 0) >>> 0
            );
          }
        } else t = 10;
        if (
          (t | 0) == 10
            ? (
                (t = 0),
                (o = f[k >> 2] | 0),
                (p = f[l >> 2] | 0),
                (o | 0) != (p | 0)
              )
            : 0
        ) {
          c = o;
          a = p;
          i = 0;
          do {
            g = a;
            f[r >> 2] = d;
            h = (g + ((i * 116) | 0) + 108) | 0;
            e = f[h >> 2] | 0;
            if (e >>> 0 < (f[(g + ((i * 116) | 0) + 112) >> 2] | 0) >>> 0) {
              f[e >> 2] = d;
              f[h >> 2] = e + 4;
            } else {
              hk((g + ((i * 116) | 0) + 104) | 0, r);
              a = f[l >> 2] | 0;
              c = f[k >> 2] | 0;
            }
            i = (i + 1) | 0;
          } while (i >>> 0 < ((((c - a) | 0) / 116) | 0) >>> 0);
        }
        b = (b + 1) | 0;
        if ((b | 0) == 3) break;
        d = f[(q + (b << 2)) >> 2] | 0;
      }
      u = v;
      return 1;
    }
    function Gg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0;
      v = u;
      u = (u + 16) | 0;
      q = (v + 4) | 0;
      r = v;
      d = f[b >> 2] | 0;
      f[q >> 2] = d;
      n = (a + 8) | 0;
      c = (d | 0) < 0;
      b = (d + 1) | 0;
      do
        if (!c) {
          f[(q + 4) >> 2] = (((b | 0) % 3) | 0 | 0) == 0 ? (d + -2) | 0 : b;
          if (!(((d >>> 0) % 3) | 0)) {
            b = (d + 2) | 0;
            break;
          } else {
            b = (d + -1) | 0;
            break;
          }
        } else {
          f[(q + 4) >> 2] = d;
          b = d;
        }
      while (0);
      f[(q + 8) >> 2] = b;
      m = c ? -1073741824 : ((d >>> 0) / 3) | 0;
      l = (a + 224) | 0;
      k = (a + 228) | 0;
      j = (a + 376) | 0;
      b = 0;
      while (1) {
        if (
          (d | 0) >= 0
            ? (
                (s =
                  f[((f[((f[n >> 2] | 0) + 12) >> 2] | 0) + (d << 2)) >> 2] |
                  0),
                (s | 0) >= 0
              )
            : 0
        ) {
          if (
            (((s >>> 0) / 3) | 0 | 0) >= (m | 0)
              ? (f[k >> 2] | 0) != (f[l >> 2] | 0)
              : 0
          ) {
            g = 0;
            do {
              if (km(((f[j >> 2] | 0) + (g << 4)) | 0) | 0) {
                c = f[l >> 2] | 0;
                f[r >> 2] = d;
                e = (c + ((g * 116) | 0) + 108) | 0;
                a = f[e >> 2] | 0;
                if (a >>> 0 < (f[(c + ((g * 116) | 0) + 112) >> 2] | 0) >>> 0) {
                  f[a >> 2] = d;
                  f[e >> 2] = a + 4;
                } else hk((c + ((g * 116) | 0) + 104) | 0, r);
              }
              g = (g + 1) | 0;
            } while (
              g >>> 0 <
              (((((f[k >> 2] | 0) - (f[l >> 2] | 0)) | 0) / 116) | 0) >>> 0
            );
          }
        } else t = 10;
        if (
          (t | 0) == 10
            ? (
                (t = 0),
                (o = f[k >> 2] | 0),
                (p = f[l >> 2] | 0),
                (o | 0) != (p | 0)
              )
            : 0
        ) {
          c = o;
          a = p;
          i = 0;
          do {
            e = a;
            f[r >> 2] = d;
            h = (e + ((i * 116) | 0) + 108) | 0;
            g = f[h >> 2] | 0;
            if (g >>> 0 < (f[(e + ((i * 116) | 0) + 112) >> 2] | 0) >>> 0) {
              f[g >> 2] = d;
              f[h >> 2] = g + 4;
            } else {
              hk((e + ((i * 116) | 0) + 104) | 0, r);
              a = f[l >> 2] | 0;
              c = f[k >> 2] | 0;
            }
            i = (i + 1) | 0;
          } while (i >>> 0 < ((((c - a) | 0) / 116) | 0) >>> 0);
        }
        b = (b + 1) | 0;
        if ((b | 0) == 3) break;
        d = f[(q + (b << 2)) >> 2] | 0;
      }
      u = v;
      return 1;
    }
    function Hg(a, c, d, e, g) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = La,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = La,
        y = La,
        z = La,
        A = La,
        B = 0,
        C = 0;
      w = u;
      u = (u + 32) | 0;
      t = (w + 16) | 0;
      v = w;
      h = $(n[(e + 4) >> 2]);
      if (!(h >= $(0.0))) Ga(6731, 6751, 66, 6871);
      s = ((1 << f[e >> 2]) + -1) | 0;
      hr(t);
      pp(t, h, s);
      e = f[c >> 2] | 0;
      if ((e | 0) == (f[d >> 2] | 0)) {
        t = g;
        t = f[t >> 2] | 0;
        g = (g + 4) | 0;
        g = f[g >> 2] | 0;
        v = a;
        d = v;
        f[d >> 2] = t;
        v = (v + 4) | 0;
        f[v >> 2] = g;
        u = w;
        return;
      }
      p = (t + 4) | 0;
      q = (v + 4) | 0;
      r = (v + 8) | 0;
      j = (g + 4) | 0;
      l = f[g >> 2] | 0;
      o = (l + 84) | 0;
      k = (l + 68) | 0;
      m = (l + 40) | 0;
      l = (l + 64) | 0;
      i = f[j >> 2] | 0;
      do {
        B = ((f[e >> 2] | 0) - s) | 0;
        c = (B | 0) < 0;
        y = $((c ? (0 - B) | 0 : B) | 0);
        h = $(n[p >> 2]);
        y = $(h * y);
        x = $(-y);
        A = $(n[t >> 2]);
        y = $(A * (c ? x : y));
        c = ((f[(e + 4) >> 2] | 0) - s) | 0;
        B = (c | 0) < 0;
        x = $(h * $((B ? (0 - c) | 0 : c) | 0));
        z = $(-x);
        x = $(A * (B ? z : x));
        B = ((f[(e + 8) >> 2] | 0) - s) | 0;
        c = (B | 0) < 0;
        h = $(h * $((c ? (0 - B) | 0 : B) | 0));
        z = $(-h);
        h = $(A * (c ? z : h));
        n[v >> 2] = y;
        n[q >> 2] = x;
        n[r >> 2] = h;
        c = i;
        i = (i + 1) | 0;
        f[j >> 2] = i;
        if (!(b[o >> 0] | 0)) c = f[((f[k >> 2] | 0) + (c << 2)) >> 2] | 0;
        C = m;
        B = f[C >> 2] | 0;
        c =
          Wo(
            c | 0,
            (((c | 0) < 0) << 31 >> 31) | 0,
            B | 0,
            f[(C + 4) >> 2] | 0
          ) | 0;
        li(((f[f[l >> 2] >> 2] | 0) + c) | 0, v | 0, B | 0) | 0;
        e = (e + 12) | 0;
      } while ((e | 0) != (f[d >> 2] | 0));
      B = g;
      g = B;
      g = f[g >> 2] | 0;
      B = (B + 4) | 0;
      B = f[B >> 2] | 0;
      C = a;
      v = C;
      f[v >> 2] = g;
      C = (C + 4) | 0;
      f[C >> 2] = B;
      u = w;
      return;
    }
    function Ig(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      if (!(f[(a + 64) >> 2] | 0)) {
        d = Xo(32) | 0;
        hp(d);
        h = (a + 64) | 0;
        g = f[h >> 2] | 0;
        f[h >> 2] = d;
        if (g) {
          d = f[g >> 2] | 0;
          if (d | 0) {
            e = (g + 4) | 0;
            if ((f[e >> 2] | 0) != (d | 0)) f[e >> 2] = d;
            Ns(d);
          }
          Ns(g);
          d = f[h >> 2] | 0;
        }
        cm(a, d, 0, 0, 0, 0);
        d = a;
      } else d = a;
      if (!(Ak(d, c) | 0)) return;
      b[(a + 84) >> 0] = b[(c + 84) >> 0] | 0;
      f[(a + 80) >> 2] = f[(c + 80) >> 2];
      if ((a | 0) != (c | 0))
        ih((a + 68) | 0, f[(c + 68) >> 2] | 0, f[(c + 72) >> 2] | 0);
      i = f[(c + 88) >> 2] | 0;
      if (!i) {
        a = (a + 88) | 0;
        d = f[a >> 2] | 0;
        f[a >> 2] = 0;
        if (!d) return;
        e = f[(d + 8) >> 2] | 0;
        if (e | 0) {
          g = (d + 12) | 0;
          if ((f[g >> 2] | 0) != (e | 0)) f[g >> 2] = e;
          Ns(e);
        }
        Ns(d);
        return;
      }
      l = Xo(40) | 0;
      f[l >> 2] = f[i >> 2];
      e = (l + 8) | 0;
      g = (i + 8) | 0;
      f[e >> 2] = 0;
      j = (l + 12) | 0;
      f[j >> 2] = 0;
      d = (l + 16) | 0;
      f[d >> 2] = 0;
      c = (i + 12) | 0;
      h = ((f[c >> 2] | 0) - (f[g >> 2] | 0)) | 0;
      if (h | 0) {
        if ((h | 0) < 0) xr(e);
        k = Xo(h) | 0;
        f[j >> 2] = k;
        f[e >> 2] = k;
        f[d >> 2] = k + h;
        e = f[g >> 2] | 0;
        d = ((f[c >> 2] | 0) - e) | 0;
        if ((d | 0) > 0) {
          li(k | 0, e | 0, d | 0) | 0;
          f[j >> 2] = k + d;
        }
      }
      g = (l + 24) | 0;
      k = (i + 24) | 0;
      f[g >> 2] = f[k >> 2];
      f[(g + 4) >> 2] = f[(k + 4) >> 2];
      f[(g + 8) >> 2] = f[(k + 8) >> 2];
      f[(g + 12) >> 2] = f[(k + 12) >> 2];
      a = (a + 88) | 0;
      g = f[a >> 2] | 0;
      f[a >> 2] = l;
      if (!g) return;
      d = f[(g + 8) >> 2] | 0;
      if (d | 0) {
        e = (g + 12) | 0;
        if ((f[e >> 2] | 0) != (d | 0)) f[e >> 2] = d;
        Ns(d);
      }
      Ns(g);
      return;
    }
    function Jg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0.0;
      a: do
        if (b >>> 0 <= 20)
          do
            switch (b | 0) {
              case 9: {
                d = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                b = f[d >> 2] | 0;
                f[c >> 2] = d + 4;
                f[a >> 2] = b;
                break a;
              }
              case 10: {
                d = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                b = f[d >> 2] | 0;
                f[c >> 2] = d + 4;
                d = a;
                f[d >> 2] = b;
                f[(d + 4) >> 2] = ((b | 0) < 0) << 31 >> 31;
                break a;
              }
              case 11: {
                d = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                b = f[d >> 2] | 0;
                f[c >> 2] = d + 4;
                d = a;
                f[d >> 2] = b;
                f[(d + 4) >> 2] = 0;
                break a;
              }
              case 12: {
                d = ((f[c >> 2] | 0) + (8 - 1)) & ~(8 - 1);
                b = d;
                e = f[b >> 2] | 0;
                b = f[(b + 4) >> 2] | 0;
                f[c >> 2] = d + 8;
                d = a;
                f[d >> 2] = e;
                f[(d + 4) >> 2] = b;
                break a;
              }
              case 13: {
                e = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                d = f[e >> 2] | 0;
                f[c >> 2] = e + 4;
                d = (d & 65535) << 16 >> 16;
                e = a;
                f[e >> 2] = d;
                f[(e + 4) >> 2] = ((d | 0) < 0) << 31 >> 31;
                break a;
              }
              case 14: {
                e = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                d = f[e >> 2] | 0;
                f[c >> 2] = e + 4;
                e = a;
                f[e >> 2] = d & 65535;
                f[(e + 4) >> 2] = 0;
                break a;
              }
              case 15: {
                e = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                d = f[e >> 2] | 0;
                f[c >> 2] = e + 4;
                d = (d & 255) << 24 >> 24;
                e = a;
                f[e >> 2] = d;
                f[(e + 4) >> 2] = ((d | 0) < 0) << 31 >> 31;
                break a;
              }
              case 16: {
                e = ((f[c >> 2] | 0) + (4 - 1)) & ~(4 - 1);
                d = f[e >> 2] | 0;
                f[c >> 2] = e + 4;
                e = a;
                f[e >> 2] = d & 255;
                f[(e + 4) >> 2] = 0;
                break a;
              }
              case 17: {
                e = ((f[c >> 2] | 0) + (8 - 1)) & ~(8 - 1);
                g = +p[e >> 3];
                f[c >> 2] = e + 8;
                p[a >> 3] = g;
                break a;
              }
              case 18: {
                e = ((f[c >> 2] | 0) + (8 - 1)) & ~(8 - 1);
                g = +p[e >> 3];
                f[c >> 2] = e + 8;
                p[a >> 3] = g;
                break a;
              }
              default:
                break a;
            }
          while (0);
      while (0);
      return;
    }
    function Kg(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = u;
      u = (u + 32) | 0;
      m = n;
      l = (n + 16) | 0;
      h = f[(b + 4) >> 2] | 0;
      if ((d | 0) <= -1) Ga(22591, 22607, 59, 22698);
      i = f[(h + 8) >> 2] | 0;
      if (((((f[(h + 12) >> 2] | 0) - i) >> 2) | 0) <= (d | 0))
        Ga(22708, 22607, 60, 22698);
      i = f[(i + (d << 2)) >> 2] | 0;
      do
        if (
          (((c + -1) | 0) >>> 0 < 6) &
          ((Sa[f[((f[b >> 2] | 0) + 8) >> 2] & 255](b) | 0) == 1)
        ) {
          j = Sa[f[((f[b >> 2] | 0) + 36) >> 2] & 255](b) | 0;
          k = Wa[f[((f[b >> 2] | 0) + 44) >> 2] & 127](b, d) | 0;
          if (((j | 0) == 0) | ((k | 0) == 0)) {
            f[a >> 2] = 0;
            u = n;
            return;
          }
          h = Wa[f[((f[b >> 2] | 0) + 40) >> 2] & 127](b, d) | 0;
          if (!h) {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = j;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            ad(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          } else {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = h;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            $c(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          }
        }
      while (0);
      f[a >> 2] = 0;
      u = n;
      return;
    }
    function Lg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0;
      s = u;
      u = (u + 16) | 0;
      p = (s + 4) | 0;
      q = s;
      c = f[b >> 2] | 0;
      f[p >> 2] = c;
      m = (a + 8) | 0;
      b = (c + 1) | 0;
      do
        if ((c | 0) >= 0) {
          f[(p + 4) >> 2] = (((b | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : b;
          if (!(((c >>> 0) % 3) | 0)) {
            b = (c + 2) | 0;
            break;
          } else {
            b = (c + -1) | 0;
            break;
          }
        } else {
          f[(p + 4) >> 2] = c;
          b = c;
        }
      while (0);
      f[(p + 8) >> 2] = b;
      l = (a + 224) | 0;
      k = (a + 228) | 0;
      j = (a + 376) | 0;
      b = 0;
      while (1) {
        if (
          (c | 0) >= 0
            ? (f[((f[((f[m >> 2] | 0) + 12) >> 2] | 0) + (c << 2)) >> 2] | 0) >=
                0
            : 0
        ) {
          if ((f[k >> 2] | 0) != (f[l >> 2] | 0)) {
            g = 0;
            do {
              if (km(((f[j >> 2] | 0) + (g << 4)) | 0) | 0) {
                a = f[l >> 2] | 0;
                f[q >> 2] = c;
                e = (a + ((g * 116) | 0) + 108) | 0;
                d = f[e >> 2] | 0;
                if (d >>> 0 < (f[(a + ((g * 116) | 0) + 112) >> 2] | 0) >>> 0) {
                  f[d >> 2] = c;
                  f[e >> 2] = d + 4;
                } else hk((a + ((g * 116) | 0) + 104) | 0, q);
              }
              g = (g + 1) | 0;
            } while (
              g >>> 0 <
              (((((f[k >> 2] | 0) - (f[l >> 2] | 0)) | 0) / 116) | 0) >>> 0
            );
          }
        } else r = 11;
        if (
          (r | 0) == 11
            ? (
                (r = 0),
                (n = f[k >> 2] | 0),
                (o = f[l >> 2] | 0),
                (n | 0) != (o | 0)
              )
            : 0
        ) {
          a = o;
          d = n;
          i = 0;
          do {
            e = a;
            f[q >> 2] = c;
            h = (e + ((i * 116) | 0) + 108) | 0;
            g = f[h >> 2] | 0;
            if (g >>> 0 < (f[(e + ((i * 116) | 0) + 112) >> 2] | 0) >>> 0) {
              f[g >> 2] = c;
              f[h >> 2] = g + 4;
            } else {
              hk((e + ((i * 116) | 0) + 104) | 0, q);
              a = f[l >> 2] | 0;
              d = f[k >> 2] | 0;
            }
            i = (i + 1) | 0;
          } while (i >>> 0 < ((((d - a) | 0) / 116) | 0) >>> 0);
        }
        b = (b + 1) | 0;
        if ((b | 0) == 3) break;
        c = f[(p + (b << 2)) >> 2] | 0;
      }
      u = s;
      return 1;
    }
    function Mg(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = u;
      u = (u + 32) | 0;
      m = n;
      l = (n + 16) | 0;
      h = f[(b + 4) >> 2] | 0;
      if ((d | 0) <= -1) Ga(22591, 22607, 59, 22698);
      i = f[(h + 8) >> 2] | 0;
      if (((((f[(h + 12) >> 2] | 0) - i) >> 2) | 0) <= (d | 0))
        Ga(22708, 22607, 60, 22698);
      i = f[(i + (d << 2)) >> 2] | 0;
      do
        if (
          (((c + -1) | 0) >>> 0 < 6) &
          ((Sa[f[((f[b >> 2] | 0) + 8) >> 2] & 255](b) | 0) == 1)
        ) {
          j = Sa[f[((f[b >> 2] | 0) + 36) >> 2] & 255](b) | 0;
          k = Wa[f[((f[b >> 2] | 0) + 44) >> 2] & 127](b, d) | 0;
          if (((j | 0) == 0) | ((k | 0) == 0)) {
            f[a >> 2] = 0;
            u = n;
            return;
          }
          h = Wa[f[((f[b >> 2] | 0) + 40) >> 2] & 127](b, d) | 0;
          if (!h) {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = j;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            cd(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          } else {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = h;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            bd(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          }
        }
      while (0);
      f[a >> 2] = 0;
      u = n;
      return;
    }
    function Ng(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      o = u;
      u = (u + 32) | 0;
      m = (o + 12) | 0;
      l = o;
      d = (b * 3) | 0;
      f[m >> 2] = 0;
      n = (m + 4) | 0;
      f[n >> 2] = 0;
      f[(m + 8) >> 2] = 0;
      do
        if (b)
          if (d >>> 0 > 1073741823) {
            xr(m);
            o = Ia(4) | 0;
            ps(o);
            sa(o | 0, 1488, 137);
          } else {
            j = (b * 12) | 0;
            c = Xo(j) | 0;
            f[m >> 2] = c;
            k = (c + (d << 2)) | 0;
            f[(m + 8) >> 2] = k;
            Gk(c | 0, 0, j | 0) | 0;
            f[n >> 2] = k;
            break;
          }
        else c = 0;
      while (0);
      if (yk(d, 1, f[(a + 32) >> 2] | 0, c) | 0)
        if ((b | 0) > 0) {
          h = (a + 44) | 0;
          i = (l + 4) | 0;
          j = (l + 8) | 0;
          e = 0;
          g = 0;
          k = 0;
          while (1) {
            f[l >> 2] = 0;
            f[(l + 4) >> 2] = 0;
            f[(l + 8) >> 2] = 0;
            d = f[m >> 2] | 0;
            p = f[(d + (k << 2)) >> 2] | 0;
            c = p >>> 1;
            c = ((((p & 1) | 0) == 0 ? c : (0 - c) | 0) + g) | 0;
            f[l >> 2] = c;
            p = f[(d + ((k + 1) << 2)) >> 2] | 0;
            a = p >>> 1;
            c = ((((p & 1) | 0) == 0 ? a : (0 - a) | 0) + c) | 0;
            f[i >> 2] = c;
            d = f[(d + ((k + 2) << 2)) >> 2] | 0;
            a = d >>> 1;
            g = ((((d & 1) | 0) == 0 ? a : (0 - a) | 0) + c) | 0;
            f[j >> 2] = g;
            c = f[h >> 2] | 0;
            a = (c + 100) | 0;
            d = f[a >> 2] | 0;
            if ((d | 0) == (f[(c + 104) >> 2] | 0)) Oj((c + 96) | 0, l);
            else {
              f[d >> 2] = f[l >> 2];
              f[(d + 4) >> 2] = f[(l + 4) >> 2];
              f[(d + 8) >> 2] = f[(l + 8) >> 2];
              f[a >> 2] = (f[a >> 2] | 0) + 12;
            }
            e = (e + 1) | 0;
            if ((e | 0) >= (b | 0)) {
              a = 1;
              break;
            } else k = (k + 3) | 0;
          }
        } else a = 1;
      else a = 0;
      c = f[m >> 2] | 0;
      if (!c) {
        u = o;
        return a | 0;
      }
      d = f[n >> 2] | 0;
      if ((d | 0) != (c | 0))
        f[n >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
      Ns(c);
      u = o;
      return a | 0;
    }
    function Og(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = u;
      u = (u + 32) | 0;
      m = n;
      l = (n + 16) | 0;
      h = f[(b + 4) >> 2] | 0;
      if ((d | 0) <= -1) Ga(22591, 22607, 59, 22698);
      i = f[(h + 8) >> 2] | 0;
      if (((((f[(h + 12) >> 2] | 0) - i) >> 2) | 0) <= (d | 0))
        Ga(22708, 22607, 60, 22698);
      i = f[(i + (d << 2)) >> 2] | 0;
      do
        if (
          (((c + -1) | 0) >>> 0 < 6) &
          ((Sa[f[((f[b >> 2] | 0) + 8) >> 2] & 255](b) | 0) == 1)
        ) {
          j = Sa[f[((f[b >> 2] | 0) + 36) >> 2] & 255](b) | 0;
          k = Wa[f[((f[b >> 2] | 0) + 44) >> 2] & 127](b, d) | 0;
          if (((j | 0) == 0) | ((k | 0) == 0)) {
            f[a >> 2] = 0;
            u = n;
            return;
          }
          h = Wa[f[((f[b >> 2] | 0) + 40) >> 2] & 127](b, d) | 0;
          if (!h) {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = j;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            Fc(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          } else {
            f[m >> 2] = f[(b + 44) >> 2];
            f[(m + 4) >> 2] = h;
            f[(m + 12) >> 2] = k;
            f[(m + 8) >> 2] = k + 12;
            Ec(a, l, c, i, e, m, g);
            if (!(f[a >> 2] | 0)) {
              f[a >> 2] = 0;
              break;
            }
            u = n;
            return;
          }
        }
      while (0);
      f[a >> 2] = 0;
      u = n;
      return;
    }
    function Pg(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0;
      h = u;
      u = (u + 16) | 0;
      e = (h + 12) | 0;
      c = h;
      g = Xo(52) | 0;
      f[g >> 2] = 0;
      f[(g + 4) >> 2] = 0;
      f[(g + 8) >> 2] = 0;
      f[(g + 12) >> 2] = 0;
      n[(g + 16) >> 2] = $(1.0);
      d = (g + 20) | 0;
      f[d >> 2] = 0;
      f[(d + 4) >> 2] = 0;
      f[(d + 8) >> 2] = 0;
      f[(d + 12) >> 2] = 0;
      n[(g + 36) >> 2] = $(1.0);
      f[(g + 40) >> 2] = 0;
      f[(g + 44) >> 2] = 0;
      f[(g + 48) >> 2] = 0;
      d = g;
      ls(e);
      if (!(ji(e, f[(b + 32) >> 2] | 0, g) | 0)) {
        f[c >> 2] = 0;
        f[(c + 4) >> 2] = 0;
        f[(c + 8) >> 2] = 0;
        ql(c, 21350, 26);
        f[a >> 2] = -1;
        Rm((a + 4) | 0, c);
        wq(c);
        d = (g + 40) | 0;
        c = f[d >> 2] | 0;
        if (c | 0) {
          e = (g + 44) | 0;
          b = f[e >> 2] | 0;
          if ((b | 0) != (c | 0)) {
            do {
              a = (b + -4) | 0;
              f[e >> 2] = a;
              b = f[a >> 2] | 0;
              f[a >> 2] = 0;
              if (b | 0) {
                qk(b);
                Ns(b);
              }
              b = f[e >> 2] | 0;
            } while ((b | 0) != (c | 0));
            c = f[d >> 2] | 0;
          }
          Ns(c);
        }
        qk(g);
        Ns(g);
        u = h;
        return;
      }
      e = ((f[(b + 4) >> 2] | 0) + 4) | 0;
      g = f[e >> 2] | 0;
      f[e >> 2] = d;
      if (g | 0) {
        d = (g + 40) | 0;
        c = f[d >> 2] | 0;
        if (c | 0) {
          e = (g + 44) | 0;
          b = f[e >> 2] | 0;
          if ((b | 0) != (c | 0)) {
            do {
              i = (b + -4) | 0;
              f[e >> 2] = i;
              b = f[i >> 2] | 0;
              f[i >> 2] = 0;
              if (b | 0) {
                qk(b);
                Ns(b);
              }
              b = f[e >> 2] | 0;
            } while ((b | 0) != (c | 0));
            c = f[d >> 2] | 0;
          }
          Ns(c);
        }
        qk(g);
        Ns(g);
      }
      f[a >> 2] = 0;
      f[(a + 4) >> 2] = 0;
      f[(a + 8) >> 2] = 0;
      f[(a + 12) >> 2] = 0;
      u = h;
      return;
    }
    function Qg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0;
      n = f[(a + 8) >> 2] | 0;
      k = (a + 76) | 0;
      d = f[k >> 2] | 0;
      m = f[(d + 80) >> 2] | 0;
      r = (c + 84) | 0;
      b[r >> 0] = 0;
      j = (c + 68) | 0;
      h = (c + 72) | 0;
      g = f[h >> 2] | 0;
      e = f[j >> 2] | 0;
      l = (g - e) >> 2;
      if (m >>> 0 <= l >>> 0) {
        if (
          m >>> 0 < l >>> 0 ? ((i = (e + (m << 2)) | 0), (g | 0) != (i | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - i) | 0) >>> 2) << 2);
      } else {
        Di(j, (m - l) | 0, 4664);
        m = f[k >> 2] | 0;
        d = m;
        m = f[(m + 80) >> 2] | 0;
      }
      p = ((f[(d + 100) >> 2] | 0) - (f[(d + 96) >> 2] | 0)) | 0;
      q = ((p | 0) / 12) | 0;
      if ((p | 0) <= 0) {
        r = 1;
        return r | 0;
      }
      p = (n + 28) | 0;
      o = (a + 80) | 0;
      n = (c + 68) | 0;
      a = (d + 96) | 0;
      k = (d + 100) | 0;
      l = 0;
      while (1) {
        d = f[a >> 2] | 0;
        if ((l | 0) >= (((((f[k >> 2] | 0) - d) | 0) / 12) | 0 | 0)) {
          e = 9;
          break;
        }
        i = (l * 3) | 0;
        g = f[p >> 2] | 0;
        h = f[((f[o >> 2] | 0) + 12) >> 2] | 0;
        e = f[(h + (f[(g + (i << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 14;
          break;
        }
        if (b[r >> 0] | 0) {
          e = 12;
          break;
        }
        j = f[n >> 2] | 0;
        f[(j + (f[(d + ((l * 12) | 0)) >> 2] << 2)) >> 2] = e;
        e = f[(h + (f[(g + ((i + 1) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 14;
          break;
        }
        f[(j + (f[(d + ((l * 12) | 0) + 4) >> 2] << 2)) >> 2] = e;
        e = f[(h + (f[(g + ((i + 2) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 14;
          break;
        }
        f[(j + (f[(d + ((l * 12) | 0) + 8) >> 2] << 2)) >> 2] = e;
        l = (l + 1) | 0;
        if ((l | 0) >= (q | 0)) {
          d = 1;
          e = 14;
          break;
        }
      }
      if ((e | 0) == 9) Ga(22874, 22792, 64, 22869);
      else if ((e | 0) == 12) Ga(21891, 21910, 89, 22004);
      else if ((e | 0) == 14) return d | 0;
      return 0;
    }
    function Rg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      l = u;
      u = (u + 32) | 0;
      k = l;
      h = (a + 8) | 0;
      g = f[h >> 2] | 0;
      j = (a + 4) | 0;
      d = f[j >> 2] | 0;
      if (((((g - d) | 0) / 116) | 0) >>> 0 >= c >>> 0) {
        do {
          f[d >> 2] = -1;
          Yn((d + 4) | 0);
          b[(d + 72) >> 0] = 1;
          d = (d + 76) | 0;
          e = (d + 40) | 0;
          do {
            f[d >> 2] = 0;
            d = (d + 4) | 0;
          } while ((d | 0) < (e | 0));
          d = ((f[j >> 2] | 0) + 116) | 0;
          f[j >> 2] = d;
          c = (c + -1) | 0;
        } while ((c | 0) != 0);
        u = l;
        return;
      }
      e = f[a >> 2] | 0;
      i = (((((d - e) | 0) / 116) | 0) + c) | 0;
      if (i >>> 0 > 37025580) {
        xr(a);
        e = f[a >> 2] | 0;
        g = f[h >> 2] | 0;
        d = f[j >> 2] | 0;
      }
      j = (((g - e) | 0) / 116) | 0;
      g = j << 1;
      g = j >>> 0 < 18512790 ? (g >>> 0 < i >>> 0 ? i : g) : 37025580;
      d = (((d - e) | 0) / 116) | 0;
      f[(k + 12) >> 2] = 0;
      f[(k + 16) >> 2] = a + 8;
      do
        if (g)
          if (g >>> 0 > 37025580) {
            l = Ia(4) | 0;
            ps(l);
            sa(l | 0, 1488, 137);
          } else {
            e = Xo((g * 116) | 0) | 0;
            break;
          }
        else e = 0;
      while (0);
      f[k >> 2] = e;
      d = (e + ((d * 116) | 0)) | 0;
      h = (k + 8) | 0;
      f[h >> 2] = d;
      f[(k + 4) >> 2] = d;
      f[(k + 12) >> 2] = e + ((g * 116) | 0);
      do {
        f[d >> 2] = -1;
        Yn((d + 4) | 0);
        b[(d + 72) >> 0] = 1;
        d = (d + 76) | 0;
        e = (d + 40) | 0;
        do {
          f[d >> 2] = 0;
          d = (d + 4) | 0;
        } while ((d | 0) < (e | 0));
        d = ((f[h >> 2] | 0) + 116) | 0;
        f[h >> 2] = d;
        c = (c + -1) | 0;
      } while ((c | 0) != 0);
      Md(a, k);
      _j(k);
      u = l;
      return;
    }
    function Sg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = f[(a + 8) >> 2] | 0;
      k = (a + 76) | 0;
      d = f[k >> 2] | 0;
      m = f[(d + 80) >> 2] | 0;
      q = (c + 84) | 0;
      b[q >> 0] = 0;
      j = (c + 68) | 0;
      h = (c + 72) | 0;
      g = f[h >> 2] | 0;
      e = f[j >> 2] | 0;
      l = (g - e) >> 2;
      if (m >>> 0 <= l >>> 0) {
        if (
          m >>> 0 < l >>> 0 ? ((i = (e + (m << 2)) | 0), (g | 0) != (i | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - i) | 0) >>> 2) << 2);
      } else {
        Di(j, (m - l) | 0, 4664);
        m = f[k >> 2] | 0;
        d = m;
        m = f[(m + 80) >> 2] | 0;
      }
      n = ((f[(d + 100) >> 2] | 0) - (f[(d + 96) >> 2] | 0)) | 0;
      o = ((n | 0) / 12) | 0;
      if ((n | 0) <= 0) {
        q = 1;
        return q | 0;
      }
      n = (a + 80) | 0;
      l = (c + 68) | 0;
      a = (d + 96) | 0;
      j = (d + 100) | 0;
      k = 0;
      while (1) {
        d = f[a >> 2] | 0;
        if ((k | 0) >= (((((f[j >> 2] | 0) - d) | 0) / 12) | 0 | 0)) {
          e = 9;
          break;
        }
        h = (k * 3) | 0;
        g = f[((f[n >> 2] | 0) + 12) >> 2] | 0;
        e = f[(g + (f[((f[p >> 2] | 0) + (h << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        if (b[q >> 0] | 0) {
          e = 12;
          break;
        }
        i = f[l >> 2] | 0;
        f[(i + (f[(d + ((k * 12) | 0)) >> 2] << 2)) >> 2] = e;
        e = f[(g + (f[((f[p >> 2] | 0) + ((h + 1) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        f[(i + (f[(d + ((k * 12) | 0) + 4) >> 2] << 2)) >> 2] = e;
        e = f[(g + (f[((f[p >> 2] | 0) + ((h + 2) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        f[(i + (f[(d + ((k * 12) | 0) + 8) >> 2] << 2)) >> 2] = e;
        k = (k + 1) | 0;
        if ((k | 0) >= (o | 0)) {
          d = 1;
          e = 13;
          break;
        }
      }
      if ((e | 0) == 9) Ga(22874, 22792, 64, 22869);
      else if ((e | 0) == 12) Ga(21891, 21910, 89, 22004);
      else if ((e | 0) == 13) return d | 0;
      return 0;
    }
    function Tg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (Ve(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Lf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 4194304) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 4194304);
                }
              while (0);
              p = d & 1048575;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 20) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function Ug(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (We(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Mf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 2097152) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 2097152);
                }
              while (0);
              p = d & 524287;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 19) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function Vg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (Xe(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Nf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 1048576) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 1048576);
                }
              while (0);
              p = d & 262143;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 18) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function Wg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (Ye(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Of(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 262144) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 262144);
                }
              while (0);
              p = d & 65535;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 16) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function Xg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (Ze(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Pf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 131072) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 131072);
                }
              while (0);
              p = d & 32767;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 15) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function Yg(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = f[(a + 8) >> 2] | 0;
      k = (a + 112) | 0;
      d = f[k >> 2] | 0;
      m = f[(d + 80) >> 2] | 0;
      q = (c + 84) | 0;
      b[q >> 0] = 0;
      j = (c + 68) | 0;
      h = (c + 72) | 0;
      g = f[h >> 2] | 0;
      e = f[j >> 2] | 0;
      l = (g - e) >> 2;
      if (m >>> 0 <= l >>> 0) {
        if (
          m >>> 0 < l >>> 0 ? ((i = (e + (m << 2)) | 0), (g | 0) != (i | 0)) : 0
        )
          f[h >> 2] = g + (~(((g + -4 - i) | 0) >>> 2) << 2);
      } else {
        Di(j, (m - l) | 0, 4664);
        m = f[k >> 2] | 0;
        d = m;
        m = f[(m + 80) >> 2] | 0;
      }
      n = ((f[(d + 100) >> 2] | 0) - (f[(d + 96) >> 2] | 0)) | 0;
      o = ((n | 0) / 12) | 0;
      if ((n | 0) <= 0) {
        q = 1;
        return q | 0;
      }
      n = (a + 116) | 0;
      l = (c + 68) | 0;
      a = (d + 96) | 0;
      j = (d + 100) | 0;
      k = 0;
      while (1) {
        d = f[a >> 2] | 0;
        if ((k | 0) >= (((((f[j >> 2] | 0) - d) | 0) / 12) | 0 | 0)) {
          e = 9;
          break;
        }
        h = (k * 3) | 0;
        g = f[((f[n >> 2] | 0) + 12) >> 2] | 0;
        e = f[(g + (f[((f[p >> 2] | 0) + (h << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        if (b[q >> 0] | 0) {
          e = 12;
          break;
        }
        i = f[l >> 2] | 0;
        f[(i + (f[(d + ((k * 12) | 0)) >> 2] << 2)) >> 2] = e;
        e = f[(g + (f[((f[p >> 2] | 0) + ((h + 1) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        f[(i + (f[(d + ((k * 12) | 0) + 4) >> 2] << 2)) >> 2] = e;
        e = f[(g + (f[((f[p >> 2] | 0) + ((h + 2) << 2)) >> 2] << 2)) >> 2] | 0;
        if (e >>> 0 >= m >>> 0) {
          d = 0;
          e = 13;
          break;
        }
        f[(i + (f[(d + ((k * 12) | 0) + 8) >> 2] << 2)) >> 2] = e;
        k = (k + 1) | 0;
        if ((k | 0) >= (o | 0)) {
          d = 1;
          e = 13;
          break;
        }
      }
      if ((e | 0) == 9) Ga(22874, 22792, 64, 22869);
      else if ((e | 0) == 12) Ga(21891, 21910, 89, 22004);
      else if ((e | 0) == 13) return d | 0;
      return 0;
    }
    function Zg(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if (_e(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Qf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 32768) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 32768);
                }
              while (0);
              p = d & 8191;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 13) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function _g(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      n = u;
      u = (u + 64) | 0;
      m = n;
      d = m;
      e = (d + 40) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      do
        if ($e(m, b) | 0) {
          e = (a | 0) > 0;
          if (e ? (f[(m + 12) >> 2] | 0) == 0 : 0) {
            g = 0;
            break;
          }
          d = Rf(m, b) | 0;
          if (d & e) {
            j = (m + 44) | 0;
            l = (m + 48) | 0;
            i = (m + 40) | 0;
            b = (m + 16) | 0;
            g = (m + 28) | 0;
            d = f[l >> 2] | 0;
            k = 0;
            while (1) {
              a: do
                if (d >>> 0 < 16384) {
                  e = f[j >> 2] | 0;
                  do {
                    if ((e | 0) <= 0) break a;
                    o = f[i >> 2] | 0;
                    e = (e + -1) | 0;
                    f[j >> 2] = e;
                    d = h[(o + e) >> 0] | 0 | (d << 8);
                    f[l >> 2] = d;
                  } while (d >>> 0 < 16384);
                }
              while (0);
              p = d & 4095;
              o = f[((f[b >> 2] | 0) + (p << 2)) >> 2] | 0;
              e = f[g >> 2] | 0;
              d =
                ((X(f[(e + (o << 3)) >> 2] | 0, d >>> 12) | 0) +
                  p -
                  (f[(e + (o << 3) + 4) >> 2] | 0)) |
                0;
              f[l >> 2] = d;
              f[(c + (k << 2)) >> 2] = o;
              k = (k + 1) | 0;
              if ((k | 0) == (a | 0)) {
                g = 1;
                break;
              }
            }
          } else g = d;
        } else g = 0;
      while (0);
      d = f[(m + 28) >> 2] | 0;
      if (d | 0) {
        b = (m + 32) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -8 - d) | 0) >>> 3) << 3);
        Ns(d);
      }
      d = f[(m + 16) >> 2] | 0;
      if (d | 0) {
        b = (m + 20) | 0;
        e = f[b >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[b >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      b = f[m >> 2] | 0;
      if (!b) {
        u = n;
        return g | 0;
      }
      e = (m + 4) | 0;
      d = f[e >> 2] | 0;
      if ((d | 0) != (b | 0))
        f[e >> 2] = d + (~(((d + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      u = n;
      return g | 0;
    }
    function $g(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = b;
      h = (c - m) >> 2;
      i = (a + 8) | 0;
      d = f[i >> 2] | 0;
      j = f[a >> 2] | 0;
      k = j;
      if (h >>> 0 <= (d - j) >> 2 >>> 0) {
        l = (a + 4) | 0;
        a = ((f[l >> 2] | 0) - j) >> 2;
        h = h >>> 0 > a >>> 0;
        a = (b + (a << 2)) | 0;
        g = h ? a : c;
        i = g;
        e = (i - m) | 0;
        d = e >> 2;
        if (d | 0) _n(j | 0, b | 0, e | 0) | 0;
        d = (k + (d << 2)) | 0;
        if (!h) {
          b = f[l >> 2] | 0;
          if ((b | 0) == (d | 0)) return;
          f[l >> 2] = b + (~(((b + -4 - d) | 0) >>> 2) << 2);
          return;
        }
        if ((g | 0) == (c | 0)) return;
        g = f[l >> 2] | 0;
        e = ((((c + -4 - i) | 0) >>> 2) + 1) | 0;
        d = g;
        b = a;
        while (1) {
          f[d >> 2] = f[b >> 2];
          b = (b + 4) | 0;
          if ((b | 0) == (c | 0)) break;
          else d = (d + 4) | 0;
        }
        f[l >> 2] = g + (e << 2);
        return;
      }
      g = j;
      if (j) {
        e = (a + 4) | 0;
        d = f[e >> 2] | 0;
        if ((d | 0) != (k | 0))
          f[e >> 2] = d + (~(((d + -4 - j) | 0) >>> 2) << 2);
        Ns(g);
        f[i >> 2] = 0;
        f[e >> 2] = 0;
        f[a >> 2] = 0;
        d = 0;
      }
      if (h >>> 0 > 1073741823) {
        xr(a);
        e = f[a >> 2] | 0;
        d = f[i >> 2] | 0;
      } else e = 0;
      l = (d - e) | 0;
      d = l >> 1;
      d = l >> 2 >>> 0 < 536870911 ? (d >>> 0 < h >>> 0 ? h : d) : 1073741823;
      if (d >>> 0 > 1073741823) {
        xr(a);
        c = Ia(4) | 0;
        ps(c);
        sa(c | 0, 1488, 137);
      }
      h = Xo(d << 2) | 0;
      g = (a + 4) | 0;
      f[g >> 2] = h;
      f[a >> 2] = h;
      f[i >> 2] = h + (d << 2);
      if ((b | 0) == (c | 0)) return;
      d = ((((c + -4 - m) | 0) >>> 2) + 1) | 0;
      e = h;
      while (1) {
        f[e >> 2] = f[b >> 2];
        b = (b + 4) | 0;
        if ((b | 0) == (c | 0)) break;
        else e = (e + 4) | 0;
      }
      f[g >> 2] = h + (d << 2);
      return;
    }
    function ah(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = b;
      h = (c - m) >> 2;
      i = (a + 8) | 0;
      d = f[i >> 2] | 0;
      j = f[a >> 2] | 0;
      k = j;
      if (h >>> 0 <= (d - j) >> 2 >>> 0) {
        l = (a + 4) | 0;
        a = ((f[l >> 2] | 0) - j) >> 2;
        h = h >>> 0 > a >>> 0;
        a = (b + (a << 2)) | 0;
        g = h ? a : c;
        i = g;
        e = (i - m) | 0;
        d = e >> 2;
        if (d | 0) _n(j | 0, b | 0, e | 0) | 0;
        d = (k + (d << 2)) | 0;
        if (!h) {
          b = f[l >> 2] | 0;
          if ((b | 0) == (d | 0)) return;
          f[l >> 2] = b + (~(((b + -4 - d) | 0) >>> 2) << 2);
          return;
        }
        if ((g | 0) == (c | 0)) return;
        g = f[l >> 2] | 0;
        d = (c + -4 - i) | 0;
        e = g;
        b = a;
        while (1) {
          f[e >> 2] = f[b >> 2];
          b = (b + 4) | 0;
          if ((b | 0) == (c | 0)) break;
          else e = (e + 4) | 0;
        }
        f[l >> 2] = g + (((d >>> 2) + 1) << 2);
        return;
      }
      g = j;
      if (j) {
        e = (a + 4) | 0;
        d = f[e >> 2] | 0;
        if ((d | 0) != (k | 0))
          f[e >> 2] = d + (~(((d + -4 - j) | 0) >>> 2) << 2);
        Ns(g);
        f[i >> 2] = 0;
        f[e >> 2] = 0;
        f[a >> 2] = 0;
        d = 0;
      }
      if (h >>> 0 > 1073741823) {
        xr(a);
        e = f[a >> 2] | 0;
        d = f[i >> 2] | 0;
      } else e = 0;
      l = (d - e) | 0;
      d = l >> 1;
      d = l >> 2 >>> 0 < 536870911 ? (d >>> 0 < h >>> 0 ? h : d) : 1073741823;
      if (d >>> 0 > 1073741823) {
        xr(a);
        c = Ia(4) | 0;
        ps(c);
        sa(c | 0, 1488, 137);
      }
      h = Xo(d << 2) | 0;
      g = (a + 4) | 0;
      f[g >> 2] = h;
      f[a >> 2] = h;
      f[i >> 2] = h + (d << 2);
      if ((b | 0) == (c | 0)) return;
      d = (c + -4 - m) | 0;
      e = h;
      while (1) {
        f[e >> 2] = f[b >> 2];
        b = (b + 4) | 0;
        if ((b | 0) == (c | 0)) break;
        else e = (e + 4) | 0;
      }
      f[g >> 2] = h + (((d >>> 2) + 1) << 2);
      return;
    }
    function bh(a) {
      a = a | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      d = b[((f[(a + 8) >> 2] | 0) + 24) >> 0] | 0;
      i = Ks(d >>> 0 > 1073741823 ? -1 : d << 2) | 0;
      j = (a + 28) | 0;
      c = f[j >> 2] | 0;
      f[j >> 2] = i;
      if (c | 0) Ls(c);
      i = (a + 4) | 0;
      g = f[((f[i >> 2] | 0) + 32) >> 2] | 0;
      d = d << 2;
      n = (g + 8) | 0;
      l = f[n >> 2] | 0;
      n = f[(n + 4) >> 2] | 0;
      e = (g + 16) | 0;
      k = e;
      c = f[k >> 2] | 0;
      k = sq(c | 0, f[(k + 4) >> 2] | 0, d | 0, 0) | 0;
      m = I;
      if (((n | 0) < (m | 0)) | (((n | 0) == (m | 0)) & (l >>> 0 < k >>> 0))) {
        n = 0;
        return n | 0;
      }
      li(f[j >> 2] | 0, ((f[g >> 2] | 0) + c) | 0, d | 0) | 0;
      c = e;
      c = sq(f[c >> 2] | 0, f[(c + 4) >> 2] | 0, d | 0, 0) | 0;
      f[e >> 2] = c;
      f[(e + 4) >> 2] = I;
      e = ((f[i >> 2] | 0) + 32) | 0;
      c = f[e >> 2] | 0;
      k = (c + 8) | 0;
      m = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      g = (c + 16) | 0;
      n = g;
      d = f[n >> 2] | 0;
      n = sq(d | 0, f[(n + 4) >> 2] | 0, 4, 0) | 0;
      l = I;
      if (((k | 0) < (l | 0)) | (((k | 0) == (l | 0)) & (m >>> 0 < n >>> 0))) {
        n = 0;
        return n | 0;
      }
      n = (a + 32) | 0;
      c = ((f[c >> 2] | 0) + d) | 0;
      c =
        h[c >> 0] |
        (h[(c + 1) >> 0] << 8) |
        (h[(c + 2) >> 0] << 16) |
        (h[(c + 3) >> 0] << 24);
      b[n >> 0] = c;
      b[(n + 1) >> 0] = c >> 8;
      b[(n + 2) >> 0] = c >> 16;
      b[(n + 3) >> 0] = c >> 24;
      n = g;
      n = sq(f[n >> 2] | 0, f[(n + 4) >> 2] | 0, 4, 0) | 0;
      c = g;
      f[c >> 2] = n;
      f[(c + 4) >> 2] = I;
      c = f[e >> 2] | 0;
      n = (c + 8) | 0;
      m = f[(n + 4) >> 2] | 0;
      g = (c + 16) | 0;
      e = g;
      d = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      if (
        !(
          ((m | 0) > (e | 0)) |
          ((m | 0) == (e | 0) ? (f[n >> 2] | 0) >>> 0 > d >>> 0 : 0)
        )
      ) {
        n = 0;
        return n | 0;
      }
      c = b[((f[c >> 2] | 0) + d) >> 0] | 0;
      m = sq(d | 0, e | 0, 1, 0) | 0;
      n = g;
      f[n >> 2] = m;
      f[(n + 4) >> 2] = I;
      if ((c & 255) > 31) {
        n = 0;
        return n | 0;
      }
      f[(a + 24) >> 2] = c & 255;
      n = 1;
      return n | 0;
    }
    function ch(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = (a + 8) | 0;
      d = f[m >> 2] | 0;
      l = (a + 4) | 0;
      g = f[l >> 2] | 0;
      e = g;
      if (((((d - g) | 0) / 12) | 0) >>> 0 >= b >>> 0) {
        Gk(g | 0, 0, (b * 12) | 0) | 0;
        f[l >> 2] = e + ((b * 12) | 0);
        return;
      }
      c = f[a >> 2] | 0;
      h = (((((g - c) | 0) / 12) | 0) + b) | 0;
      if (h >>> 0 > 357913941) {
        xr(a);
        g = f[l >> 2] | 0;
        c = f[a >> 2] | 0;
        e = g;
        d = f[m >> 2] | 0;
      }
      k = c;
      d = (((d - c) | 0) / 12) | 0;
      i = d << 1;
      i = d >>> 0 < 178956970 ? (i >>> 0 < h >>> 0 ? h : i) : 357913941;
      d = (((g - c) | 0) / 12) | 0;
      do
        if (i)
          if (i >>> 0 > 357913941) {
            a = Ia(4) | 0;
            ps(a);
            sa(a | 0, 1488, 137);
          } else {
            h = Xo((i * 12) | 0) | 0;
            break;
          }
        else h = 0;
      while (0);
      g = (h + ((d * 12) | 0)) | 0;
      d = g;
      j = (h + ((i * 12) | 0)) | 0;
      Gk(g | 0, 0, (b * 12) | 0) | 0;
      h = (g + ((b * 12) | 0)) | 0;
      if ((e | 0) == (k | 0)) i = c;
      else {
        c = d;
        do {
          b = (g + -12) | 0;
          i = e;
          e = (e + -12) | 0;
          f[b >> 2] = 0;
          d = (g + -8) | 0;
          f[d >> 2] = 0;
          f[(g + -4) >> 2] = 0;
          f[b >> 2] = f[e >> 2];
          b = (i + -8) | 0;
          f[d >> 2] = f[b >> 2];
          i = (i + -4) | 0;
          f[(g + -4) >> 2] = f[i >> 2];
          f[i >> 2] = 0;
          f[b >> 2] = 0;
          f[e >> 2] = 0;
          g = (c + -12) | 0;
          c = g;
        } while ((e | 0) != (k | 0));
        d = c;
        i = f[a >> 2] | 0;
        e = f[l >> 2] | 0;
      }
      f[a >> 2] = d;
      f[l >> 2] = h;
      f[m >> 2] = j;
      h = i;
      if ((e | 0) != (h | 0))
        do {
          c = e;
          e = (e + -12) | 0;
          g = f[e >> 2] | 0;
          if (g | 0) {
            d = (c + -8) | 0;
            c = f[d >> 2] | 0;
            if ((c | 0) != (g | 0))
              f[d >> 2] = c + (~(((c + -4 - g) | 0) >>> 2) << 2);
            Ns(g);
          }
        } while ((e | 0) != (h | 0));
      if (!i) return;
      Ns(i);
      return;
    }
    function dh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      n = u;
      u = (u + 32) | 0;
      m = (n + 24) | 0;
      k = (n + 16) | 0;
      j = (n + 8) | 0;
      l = n;
      f[a >> 2] = 4652;
      f[(a + 4) >> 2] = f[(b + 4) >> 2];
      h = (a + 8) | 0;
      i = (b + 8) | 0;
      f[h >> 2] = 0;
      e = (a + 12) | 0;
      f[e >> 2] = 0;
      d = (a + 16) | 0;
      f[d >> 2] = 0;
      g = (b + 12) | 0;
      c = f[g >> 2] | 0;
      if (c | 0) {
        if ((c | 0) < 0) xr(h);
        c = ((((c + -1) | 0) >>> 5) + 1) | 0;
        o = Xo(c << 2) | 0;
        f[h >> 2] = o;
        f[e >> 2] = 0;
        f[d >> 2] = c;
        e = f[i >> 2] | 0;
        f[j >> 2] = e;
        f[(j + 4) >> 2] = 0;
        i = f[g >> 2] | 0;
        f[l >> 2] = e + (i >>> 5 << 2);
        f[(l + 4) >> 2] = i & 31;
        f[k >> 2] = f[j >> 2];
        f[(k + 4) >> 2] = f[(j + 4) >> 2];
        f[m >> 2] = f[l >> 2];
        f[(m + 4) >> 2] = f[(l + 4) >> 2];
        yh(h, k, m);
      }
      h = (a + 20) | 0;
      f[h >> 2] = 0;
      g = (a + 24) | 0;
      f[g >> 2] = 0;
      d = (a + 28) | 0;
      f[d >> 2] = 0;
      e = (b + 24) | 0;
      c = f[e >> 2] | 0;
      if (!c) {
        u = n;
        return;
      }
      if ((c | 0) < 0) xr(h);
      o = ((((c + -1) | 0) >>> 5) + 1) | 0;
      a = Xo(o << 2) | 0;
      f[h >> 2] = a;
      f[g >> 2] = 0;
      f[d >> 2] = o;
      b = f[(b + 20) >> 2] | 0;
      f[j >> 2] = b;
      f[(j + 4) >> 2] = 0;
      o = f[e >> 2] | 0;
      f[l >> 2] = b + (o >>> 5 << 2);
      f[(l + 4) >> 2] = o & 31;
      f[k >> 2] = f[j >> 2];
      f[(k + 4) >> 2] = f[(j + 4) >> 2];
      f[m >> 2] = f[l >> 2];
      f[(m + 4) >> 2] = f[(l + 4) >> 2];
      yh(h, k, m);
      u = n;
      return;
    }
    function eh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = (a + 8) | 0;
      d = f[i >> 2] | 0;
      h = f[a >> 2] | 0;
      j = h;
      do
        if ((d - h) >> 2 >>> 0 >= b >>> 0) {
          a = (a + 4) | 0;
          i = f[a >> 2] | 0;
          h = (i - h) >> 2;
          g = h >>> 0 < b >>> 0;
          d = g ? h : b;
          if (d | 0) {
            e = j;
            while (1) {
              f[e >> 2] = f[c >> 2];
              d = (d + -1) | 0;
              if (!d) break;
              else e = (e + 4) | 0;
            }
          }
          if (!g) {
            d = (j + (b << 2)) | 0;
            if ((i | 0) == (d | 0)) return;
            else {
              e = a;
              d = (i + (~(((i + -4 - d) | 0) >>> 2) << 2)) | 0;
              break;
            }
          } else {
            g = (b - h) | 0;
            d = i;
            e = g;
            while (1) {
              f[d >> 2] = f[c >> 2];
              e = (e + -1) | 0;
              if (!e) break;
              else d = (d + 4) | 0;
            }
            e = a;
            d = (i + (g << 2)) | 0;
            break;
          }
        } else {
          g = h;
          if (h) {
            e = (a + 4) | 0;
            d = f[e >> 2] | 0;
            if ((d | 0) != (j | 0))
              f[e >> 2] = d + (~(((d + -4 - h) | 0) >>> 2) << 2);
            Ns(g);
            f[i >> 2] = 0;
            f[e >> 2] = 0;
            f[a >> 2] = 0;
            d = 0;
          }
          if (b >>> 0 > 1073741823) {
            xr(a);
            e = f[a >> 2] | 0;
            d = f[i >> 2] | 0;
          } else e = 0;
          j = (d - e) | 0;
          d = j >> 1;
          d = j >> 2 >>> 0 < 536870911
            ? d >>> 0 < b >>> 0 ? b : d
            : 1073741823;
          if (d >>> 0 > 1073741823) {
            xr(a);
            c = Ia(4) | 0;
            ps(c);
            sa(c | 0, 1488, 137);
          }
          h = Xo(d << 2) | 0;
          g = (a + 4) | 0;
          f[g >> 2] = h;
          f[a >> 2] = h;
          f[i >> 2] = h + (d << 2);
          d = h;
          e = b;
          while (1) {
            f[d >> 2] = f[c >> 2];
            e = (e + -1) | 0;
            if (!e) break;
            else d = (d + 4) | 0;
          }
          e = g;
          d = (h + (b << 2)) | 0;
        }
      while (0);
      f[e >> 2] = d;
      return;
    }
    function fh(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0;
      g = (a + 636) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 640) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      g = (a + 624) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 628) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      b = f[(a + 612) >> 2] | 0;
      if (b | 0) {
        d = (a + 616) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 600) >> 2] | 0;
      if (!b) {
        h = (a + 580) | 0;
        Om(h);
        h = (a + 560) | 0;
        Om(h);
        h = (a + 540) | 0;
        Om(h);
        h = (a + 524) | 0;
        Ss(h);
        a = (a + 12) | 0;
        Fk(a);
        return;
      }
      d = (a + 604) | 0;
      c = f[d >> 2] | 0;
      if ((c | 0) != (b | 0))
        f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      h = (a + 580) | 0;
      Om(h);
      h = (a + 560) | 0;
      Om(h);
      h = (a + 540) | 0;
      Om(h);
      h = (a + 524) | 0;
      Ss(h);
      a = (a + 12) | 0;
      Fk(a);
      return;
    }
    function gh(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = u;
      u = (u + 16) | 0;
      n = p;
      o = ((f[(c + 4) >> 2] | 0) - (f[c >> 2] | 0)) >> 2;
      k = (d + 8) | 0;
      j = f[k >> 2] | 0;
      k = f[(k + 4) >> 2] | 0;
      l = (d + 16) | 0;
      e = l;
      g = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      if (((k | 0) > (e | 0)) | (((k | 0) == (e | 0)) & (j >>> 0 > g >>> 0))) {
        i = b[((f[d >> 2] | 0) + g) >> 0] | 0;
        g = sq(g | 0, e | 0, 1, 0) | 0;
        e = I;
        q = l;
        f[q >> 2] = g;
        f[(q + 4) >> 2] = e;
        if (i << 24 >> 24 != -2) m = 3;
      } else {
        i = 0;
        m = 3;
      }
      if ((m | 0) == 3) {
        if (
          ((k | 0) > (e | 0)) |
          (((k | 0) == (e | 0)) & (j >>> 0 > g >>> 0))
        ) {
          q = b[((f[d >> 2] | 0) + g) >> 0] | 0;
          m = sq(g | 0, e | 0, 1, 0) | 0;
          e = l;
          f[e >> 2] = m;
          f[(e + 4) >> 2] = I;
          e = q;
        } else e = 0;
        Xa[f[((f[a >> 2] | 0) + 40) >> 2] & 7](
          n,
          a,
          i << 24 >> 24,
          e << 24 >> 24
        );
        q = (a + 20) | 0;
        m = f[n >> 2] | 0;
        f[n >> 2] = 0;
        e = f[q >> 2] | 0;
        f[q >> 2] = m;
        if (e) {
          Pa[f[((f[e >> 2] | 0) + 4) >> 2] & 255](e);
          e = f[n >> 2] | 0;
          f[n >> 2] = 0;
          if (e | 0) Pa[f[((f[e >> 2] | 0) + 4) >> 2] & 255](e);
        } else f[n >> 2] = 0;
      }
      e = f[(a + 20) >> 2] | 0;
      if (e | 0 ? !(Wa[f[((f[a >> 2] | 0) + 28) >> 2] & 127](a, e) | 0) : 0) {
        q = 0;
        u = p;
        return q | 0;
      }
      if (!(Na[f[((f[a >> 2] | 0) + 36) >> 2] & 31](a, c, d) | 0)) {
        q = 0;
        u = p;
        return q | 0;
      }
      q = f[(a + 4) >> 2] | 0;
      if (
        (q | 0 ? (((h[(q + 36) >> 0] | 0) << 8) & 65535) < 512 : 0)
          ? !(Wa[f[((f[a >> 2] | 0) + 48) >> 2] & 127](a, o) | 0)
          : 0
      ) {
        q = 0;
        u = p;
        return q | 0;
      }
      q = 1;
      u = p;
      return q | 0;
    }
    function hh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      n = u;
      u = (u + 32) | 0;
      m = (n + 24) | 0;
      k = (n + 16) | 0;
      j = (n + 8) | 0;
      l = n;
      f[a >> 2] = 4700;
      f[(a + 4) >> 2] = f[(b + 4) >> 2];
      h = (a + 8) | 0;
      i = (b + 8) | 0;
      f[h >> 2] = 0;
      e = (a + 12) | 0;
      f[e >> 2] = 0;
      d = (a + 16) | 0;
      f[d >> 2] = 0;
      g = (b + 12) | 0;
      c = f[g >> 2] | 0;
      if (c | 0) {
        if ((c | 0) < 0) xr(h);
        c = ((((c + -1) | 0) >>> 5) + 1) | 0;
        o = Xo(c << 2) | 0;
        f[h >> 2] = o;
        f[e >> 2] = 0;
        f[d >> 2] = c;
        e = f[i >> 2] | 0;
        f[j >> 2] = e;
        f[(j + 4) >> 2] = 0;
        i = f[g >> 2] | 0;
        f[l >> 2] = e + (i >>> 5 << 2);
        f[(l + 4) >> 2] = i & 31;
        f[k >> 2] = f[j >> 2];
        f[(k + 4) >> 2] = f[(j + 4) >> 2];
        f[m >> 2] = f[l >> 2];
        f[(m + 4) >> 2] = f[(l + 4) >> 2];
        yh(h, k, m);
      }
      h = (a + 20) | 0;
      f[h >> 2] = 0;
      g = (a + 24) | 0;
      f[g >> 2] = 0;
      d = (a + 28) | 0;
      f[d >> 2] = 0;
      e = (b + 24) | 0;
      c = f[e >> 2] | 0;
      if (!c) {
        u = n;
        return;
      }
      if ((c | 0) < 0) xr(h);
      o = ((((c + -1) | 0) >>> 5) + 1) | 0;
      a = Xo(o << 2) | 0;
      f[h >> 2] = a;
      f[g >> 2] = 0;
      f[d >> 2] = o;
      b = f[(b + 20) >> 2] | 0;
      f[j >> 2] = b;
      f[(j + 4) >> 2] = 0;
      o = f[e >> 2] | 0;
      f[l >> 2] = b + (o >>> 5 << 2);
      f[(l + 4) >> 2] = o & 31;
      f[k >> 2] = f[j >> 2];
      f[(k + 4) >> 2] = f[(j + 4) >> 2];
      f[m >> 2] = f[l >> 2];
      f[(m + 4) >> 2] = f[(l + 4) >> 2];
      yh(h, k, m);
      u = n;
      return;
    }
    function ih(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      k = c;
      e = b;
      j = (k - e) | 0;
      h = j >> 2;
      i = (a + 8) | 0;
      d = f[i >> 2] | 0;
      g = f[a >> 2] | 0;
      l = g;
      if (h >>> 0 > (d - g) >> 2 >>> 0) {
        e = g;
        if (g) {
          c = (a + 4) | 0;
          d = f[c >> 2] | 0;
          if ((d | 0) != (l | 0))
            f[c >> 2] = d + (~(((d + -4 - g) | 0) >>> 2) << 2);
          Ns(e);
          f[i >> 2] = 0;
          f[c >> 2] = 0;
          f[a >> 2] = 0;
          d = 0;
        }
        if (h >>> 0 > 1073741823) {
          xr(a);
          c = f[a >> 2] | 0;
          d = f[i >> 2] | 0;
        } else c = 0;
        l = (d - c) | 0;
        d = l >> 1;
        d = l >> 2 >>> 0 < 536870911 ? (d >>> 0 < h >>> 0 ? h : d) : 1073741823;
        if (d >>> 0 > 1073741823) {
          xr(a);
          b = Ia(4) | 0;
          ps(b);
          sa(b | 0, 1488, 137);
        }
        e = Xo(d << 2) | 0;
        c = (a + 4) | 0;
        f[c >> 2] = e;
        f[a >> 2] = e;
        f[i >> 2] = e + (d << 2);
        if ((j | 0) <= 0) return;
        li(e | 0, b | 0, j | 0) | 0;
        f[c >> 2] = e + (j >>> 2 << 2);
        return;
      }
      a = (a + 4) | 0;
      d = f[a >> 2] | 0;
      i = (d - g) >> 2;
      j = h >>> 0 > i >>> 0;
      i = j ? (b + (i << 2)) | 0 : c;
      g = d;
      h = d;
      if ((i | 0) == (b | 0)) d = l;
      else {
        e = (i + -4 - e) | 0;
        d = b;
        c = l;
        while (1) {
          f[c >> 2] = f[d >> 2];
          d = (d + 4) | 0;
          if ((d | 0) == (i | 0)) break;
          else c = (c + 4) | 0;
        }
        d = (l + (((e >>> 2) + 1) << 2)) | 0;
      }
      if (j) {
        d = (k - i) | 0;
        if ((d | 0) <= 0) return;
        li(h | 0, i | 0, d | 0) | 0;
        f[a >> 2] = (f[a >> 2] | 0) + (d >>> 2 << 2);
        return;
      } else {
        if ((g | 0) == (d | 0)) return;
        f[a >> 2] = g + (~(((g + -4 - d) | 0) >>> 2) << 2);
        return;
      }
    }
    function jh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = u;
      u = (u + 32) | 0;
      m = n;
      l = (a + 8) | 0;
      d = f[l >> 2] | 0;
      k = (a + 4) | 0;
      e = f[k >> 2] | 0;
      if ((d - e) >> 2 >>> 0 >= b >>> 0) {
        Gk(e | 0, 0, (b << 2) | 0) | 0;
        f[k >> 2] = e + (b << 2);
        u = n;
        return;
      }
      c = f[a >> 2] | 0;
      g = (((e - c) >> 2) + b) | 0;
      if (g >>> 0 > 1073741823) {
        xr(a);
        c = f[a >> 2] | 0;
        d = f[l >> 2] | 0;
        e = f[k >> 2] | 0;
      }
      i = (d - c) | 0;
      j = i >> 1;
      g = i >> 2 >>> 0 < 536870911 ? (j >>> 0 < g >>> 0 ? g : j) : 1073741823;
      c = (e - c) >> 2;
      f[(m + 12) >> 2] = 0;
      f[(m + 16) >> 2] = a + 8;
      do
        if (g)
          if (g >>> 0 > 1073741823) {
            n = Ia(4) | 0;
            ps(n);
            sa(n | 0, 1488, 137);
          } else {
            d = Xo(g << 2) | 0;
            break;
          }
        else d = 0;
      while (0);
      f[m >> 2] = d;
      c = (d + (c << 2)) | 0;
      i = (m + 8) | 0;
      h = (m + 4) | 0;
      f[h >> 2] = c;
      j = (m + 12) | 0;
      f[j >> 2] = d + (g << 2);
      Gk(c | 0, 0, (b << 2) | 0) | 0;
      f[i >> 2] = c + (b << 2);
      d = f[a >> 2] | 0;
      c = f[k >> 2] | 0;
      if ((c | 0) == (d | 0)) {
        g = h;
        e = f[h >> 2] | 0;
      } else {
        e = f[h >> 2] | 0;
        do {
          c = (c + -4) | 0;
          b = f[c >> 2] | 0;
          f[c >> 2] = 0;
          f[(e + -4) >> 2] = b;
          e = ((f[h >> 2] | 0) + -4) | 0;
          f[h >> 2] = e;
        } while ((c | 0) != (d | 0));
        g = h;
        d = f[a >> 2] | 0;
        c = f[k >> 2] | 0;
      }
      f[a >> 2] = e;
      f[g >> 2] = d;
      f[k >> 2] = f[i >> 2];
      f[i >> 2] = c;
      a = f[l >> 2] | 0;
      f[l >> 2] = f[j >> 2];
      f[j >> 2] = a;
      f[m >> 2] = f[g >> 2];
      Cj(m);
      u = n;
      return;
    }
    function kh(a) {
      a = a | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      i = (a + 12) | 0;
      h = f[a >> 2] | 0;
      j = (a + 8) | 0;
      c = f[j >> 2] | 0;
      d = (c | 0) < 0;
      if (!(b[i >> 0] | 0)) {
        do
          if (!d)
            if (!(((c >>> 0) % 3) | 0)) {
              c = (c + 2) | 0;
              break;
            } else {
              c = (c + -1) | 0;
              break;
            }
        while (0);
        do
          if (!((1 << (c & 31)) & f[((f[h >> 2] | 0) + (c >>> 5 << 2)) >> 2])) {
            if ((c | 0) >= 0) {
              c =
                f[
                  ((f[((f[(h + 64) >> 2] | 0) + 12) >> 2] | 0) + (c << 2)) >> 2
                ] | 0;
              if ((c | 0) >= 0)
                if (!(((c >>> 0) % 3) | 0)) {
                  c = (c + 2) | 0;
                  break;
                } else {
                  c = (c + -1) | 0;
                  break;
                }
            }
          } else c = -1073741824;
        while (0);
        f[j >> 2] = c;
        return;
      }
      e = (c + 1) | 0;
      if (!d) c = (((e | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : e;
      e = f[h >> 2] | 0;
      if (!((1 << (c & 31)) & f[(e + (c >>> 5 << 2)) >> 2]))
        if ((c | 0) >= 0) {
          c =
            f[((f[((f[(h + 64) >> 2] | 0) + 12) >> 2] | 0) + (c << 2)) >> 2] |
            0;
          d = (c + 1) | 0;
          if ((c | 0) >= 0) {
            c = (((d | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : d;
            f[j >> 2] = c;
            if ((c | 0) >= 0) {
              if ((c | 0) != (f[(a + 4) >> 2] | 0)) return;
              f[j >> 2] = -1073741824;
              return;
            }
          } else g = 7;
        } else g = 7;
      else {
        c = -1073741824;
        g = 7;
      }
      if ((g | 0) == 7) f[j >> 2] = c;
      c = f[(a + 4) >> 2] | 0;
      do
        if ((c | 0) >= 0)
          if (!(((c >>> 0) % 3) | 0)) {
            c = (c + 2) | 0;
            break;
          } else {
            c = (c + -1) | 0;
            break;
          }
      while (0);
      do
        if (!((1 << (c & 31)) & f[(e + (c >>> 5 << 2)) >> 2])) {
          if ((c | 0) >= 0) {
            c =
              f[((f[((f[(h + 64) >> 2] | 0) + 12) >> 2] | 0) + (c << 2)) >> 2] |
              0;
            if ((c | 0) >= 0)
              if (!(((c >>> 0) % 3) | 0)) {
                c = (c + 2) | 0;
                break;
              } else {
                c = (c + -1) | 0;
                break;
              }
          }
        } else c = -1073741824;
      while (0);
      f[j >> 2] = c;
      b[i >> 0] = 0;
      return;
    }
    function lh(a, b, c, d) {
      a = a | 0;
      b = $(b);
      c = $(c);
      d = d | 0;
      var e = La,
        f = La,
        g = 0.0,
        h = La,
        i = La,
        j = 0.0,
        k = 0.0,
        l = 0.0,
        m = 0.0;
      if (!(b >= $(0.0))) Ga(10554, 10407, 191, 10568);
      if (!(c >= $(0.0))) Ga(10597, 10407, 192, 10568);
      if (!(b <= $(1.0))) Ga(10611, 10407, 193, 10568);
      if (!(c <= $(1.0))) Ga(10625, 10407, 194, 10568);
      f = $(b + c);
      e = $(b - c);
      if (
        !(e <= $(0.5)) |
        (!(e >= $(-0.5)) | (!(f >= $(0.5)) | !(f <= $(1.5))))
      ) {
        do
          if (!(f <= $(0.5))) {
            if (f >= $(1.5)) {
              e = $($(1.5) - c);
              c = $($(1.5) - b);
              break;
            }
            if (!(e <= $(-0.5))) {
              e = $(c + $(0.5));
              c = $(b + $(-0.5));
              break;
            } else {
              e = $(c + $(-0.5));
              c = $(b + $(0.5));
              break;
            }
          } else {
            e = $($(0.5) - c);
            c = $($(0.5) - b);
          }
        while (0);
        b = e;
        i = $(e - c);
        f = $(c + e);
        g = -1.0;
      } else {
        i = e;
        g = 1.0;
      }
      h = $(+b * 2.0 + -1.0);
      b = $(+c * 2.0 + -1.0);
      l = +f * 2.0;
      j = l + -1.0;
      l = 3.0 - l;
      m = +i * 2.0;
      k = m + 1.0;
      m = 1.0 - m;
      k = m < k ? m : k;
      j = l < j ? l : j;
      c = $(g * (k < j ? k : j));
      e = $($(b * b) + $($(h * h) + $(c * c)));
      if (+e < 1.0e-6) {
        n[d >> 2] = $(0.0);
        h = $(0.0);
        i = $(0.0);
        a = (d + 4) | 0;
        n[a >> 2] = h;
        d = (d + 8) | 0;
        n[d >> 2] = i;
        return;
      } else {
        i = $($(1.0) / $(L($(e))));
        f = $(c * i);
        n[d >> 2] = f;
        h = $(h * i);
        i = $(b * i);
        a = (d + 4) | 0;
        n[a >> 2] = h;
        d = (d + 8) | 0;
        n[d >> 2] = i;
        return;
      }
    }
    function mh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0;
      m = f[a >> 2] | 0;
      p = (a + 4) | 0;
      c = f[p >> 2] | 0;
      l = m;
      d = (c + (~(((c + -4 - l) | 0) >>> 2) << 2)) | 0;
      if ((c | 0) == (m | 0)) d = m;
      else {
        f[p >> 2] = d;
        c = d;
      }
      s = (a + 16) | 0;
      f[s >> 2] = 0;
      t = (a + 12) | 0;
      f[t >> 2] = d;
      k = (b + 8) | 0;
      d = k;
      n = f[d >> 2] | 0;
      d = f[(d + 4) >> 2] | 0;
      r = (b + 16) | 0;
      g = r;
      i = f[g >> 2] | 0;
      g = sq(i | 0, f[(g + 4) >> 2] | 0, 4, 0) | 0;
      e = I;
      if (((d | 0) < (e | 0)) | (((d | 0) == (e | 0)) & (n >>> 0 < g >>> 0))) {
        a = 0;
        return a | 0;
      }
      o = ((f[b >> 2] | 0) + i) | 0;
      o =
        h[o >> 0] |
        (h[(o + 1) >> 0] << 8) |
        (h[(o + 2) >> 0] << 16) |
        (h[(o + 3) >> 0] << 24);
      j = r;
      f[j >> 2] = g;
      f[(j + 4) >> 2] = e;
      if (!(((o | 0) != 0) & (((o & 3) | 0) == 0))) {
        a = 0;
        return a | 0;
      }
      j = Ip(n | 0, d | 0, g | 0, e | 0) | 0;
      i = I;
      if ((0 > (i | 0)) | ((0 == (i | 0)) & (o >>> 0 > j >>> 0))) {
        a = 0;
        return a | 0;
      }
      j = o >>> 2;
      i = (c - l) >> 2;
      if (j >>> 0 <= i >>> 0)
        if (
          j >>> 0 < i >>> 0 ? ((q = (m + (j << 2)) | 0), (c | 0) != (q | 0)) : 0
        ) {
          f[p >> 2] = c + (~(((c + -4 - q) | 0) >>> 2) << 2);
          c = n;
        } else c = n;
      else {
        Tj(a, (j - i) | 0);
        c = k;
        e = r;
        g = f[e >> 2] | 0;
        e = f[(e + 4) >> 2] | 0;
        d = f[(c + 4) >> 2] | 0;
        c = f[c >> 2] | 0;
      }
      q = sq(g | 0, e | 0, o | 0, 0) | 0;
      p = I;
      if (((d | 0) < (p | 0)) | (((d | 0) == (p | 0)) & (c >>> 0 < q >>> 0))) {
        a = 0;
        return a | 0;
      }
      li(f[a >> 2] | 0, ((f[b >> 2] | 0) + g) | 0, o | 0) | 0;
      q = r;
      q = sq(f[q >> 2] | 0, f[(q + 4) >> 2] | 0, o | 0, 0) | 0;
      b = r;
      f[b >> 2] = q;
      f[(b + 4) >> 2] = I;
      f[t >> 2] = f[a >> 2];
      f[s >> 2] = 0;
      a = 1;
      return a | 0;
    }
    function nh(a, c, d, e) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = u;
      u = (u + 80) | 0;
      l = m;
      j = (m + 60) | 0;
      k = (m + 40) | 0;
      g = l;
      h = d;
      i = (g + 40) | 0;
      do {
        f[g >> 2] = f[h >> 2];
        g = (g + 4) | 0;
        h = (h + 4) | 0;
      } while ((g | 0) < (i | 0));
      Ic(a, l, j);
      if (f[a >> 2] | 0) {
        l = (l + 24) | 0;
        Ss(l);
        u = m;
        return;
      }
      h = (a + 4) | 0;
      wq(h);
      if (b[(j + 7) >> 0] | 0) {
        f[k >> 2] = 0;
        f[(k + 4) >> 2] = 0;
        f[(k + 8) >> 2] = 0;
        ql(k, 20094, 27);
        f[a >> 2] = -1;
        Rm(h, k);
        wq(k);
        l = (l + 24) | 0;
        Ss(l);
        u = m;
        return;
      }
      Hi(k, b[(j + 8) >> 0] | 0);
      g = f[k >> 2] | 0;
      if (!g) {
        j = (k + 16) | 0;
        g = f[j >> 2] | 0;
        f[j >> 2] = 0;
        ie(a, g, c, d, e);
        if (!(f[a >> 2] | 0)) {
          wq(h);
          f[a >> 2] = 0;
          f[(a + 4) >> 2] = 0;
          f[(a + 8) >> 2] = 0;
          f[(a + 12) >> 2] = 0;
        }
        if (g | 0) Pa[f[((f[g >> 2] | 0) + 4) >> 2] & 255](g);
      } else {
        f[a >> 2] = g;
        Rm(h, (k + 4) | 0);
      }
      c = (k + 16) | 0;
      g = f[c >> 2] | 0;
      f[c >> 2] = 0;
      if (g | 0) Pa[f[((f[g >> 2] | 0) + 4) >> 2] & 255](g);
      wq((k + 4) | 0);
      l = (l + 24) | 0;
      Ss(l);
      u = m;
      return;
    }
    function oh(a, c, d, e) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      var g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = u;
      u = (u + 80) | 0;
      l = m;
      j = (m + 60) | 0;
      k = (m + 40) | 0;
      g = l;
      h = d;
      i = (g + 40) | 0;
      do {
        f[g >> 2] = f[h >> 2];
        g = (g + 4) | 0;
        h = (h + 4) | 0;
      } while ((g | 0) < (i | 0));
      Ic(a, l, j);
      if (f[a >> 2] | 0) {
        l = (l + 24) | 0;
        Ss(l);
        u = m;
        return;
      }
      h = (a + 4) | 0;
      wq(h);
      if ((b[(j + 7) >> 0] | 0) != 1) {
        f[k >> 2] = 0;
        f[(k + 4) >> 2] = 0;
        f[(k + 8) >> 2] = 0;
        ql(k, 20073, 20);
        f[a >> 2] = -1;
        Rm(h, k);
        wq(k);
        l = (l + 24) | 0;
        Ss(l);
        u = m;
        return;
      }
      Pj(k, b[(j + 8) >> 0] | 0);
      g = f[k >> 2] | 0;
      if (!g) {
        j = (k + 16) | 0;
        g = f[j >> 2] | 0;
        f[j >> 2] = 0;
        Un(a, g, c, d, e);
        if (!(f[a >> 2] | 0)) {
          wq(h);
          f[a >> 2] = 0;
          f[(a + 4) >> 2] = 0;
          f[(a + 8) >> 2] = 0;
          f[(a + 12) >> 2] = 0;
        }
        if (g | 0) Pa[f[((f[g >> 2] | 0) + 4) >> 2] & 255](g);
      } else {
        f[a >> 2] = g;
        Rm(h, (k + 4) | 0);
      }
      c = (k + 16) | 0;
      g = f[c >> 2] | 0;
      f[c >> 2] = 0;
      if (g | 0) Pa[f[((f[g >> 2] | 0) + 4) >> 2] & 255](g);
      wq((k + 4) | 0);
      l = (l + 24) | 0;
      Ss(l);
      u = m;
      return;
    }
    function ph(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0;
      g = (a + 128) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 132) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      g = (a + 116) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 120) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      b = f[(a + 104) >> 2] | 0;
      if (b | 0) {
        d = (a + 108) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 92) >> 2] | 0;
      if (!b) {
        h = (a + 72) | 0;
        Om(h);
        h = (a + 52) | 0;
        Om(h);
        h = (a + 32) | 0;
        Om(h);
        a = (a + 12) | 0;
        Om(a);
        return;
      }
      d = (a + 96) | 0;
      c = f[d >> 2] | 0;
      if ((c | 0) != (b | 0))
        f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      h = (a + 72) | 0;
      Om(h);
      h = (a + 52) | 0;
      Om(h);
      h = (a + 32) | 0;
      Om(h);
      a = (a + 12) | 0;
      Om(a);
      return;
    }
    function qh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      k = f[b >> 2] | 0;
      l = f[k >> 2] | 0;
      e = f[(a + 4) >> 2] | 0;
      b = f[(k + 4) >> 2] | 0;
      h = (e + -1) | 0;
      i = ((h & e) | 0) == 0;
      if (i) g = h & b;
      else g = ((b >>> 0) % (e >>> 0)) | 0;
      c = ((f[a >> 2] | 0) + (g << 2)) | 0;
      j = f[c >> 2] | 0;
      while (1) {
        b = f[j >> 2] | 0;
        if ((b | 0) == (k | 0)) break;
        else j = b;
      }
      if ((j | 0) != ((a + 8) | 0)) {
        b = f[(j + 4) >> 2] | 0;
        if (i) b = b & h;
        else b = ((b >>> 0) % (e >>> 0)) | 0;
        if ((b | 0) == (g | 0)) {
          c = l;
          d = 18;
        } else d = 11;
      } else d = 11;
      do
        if ((d | 0) == 11) {
          if (l | 0) {
            b = f[(l + 4) >> 2] | 0;
            if (i) b = b & h;
            else b = ((b >>> 0) % (e >>> 0)) | 0;
            if ((b | 0) == (g | 0)) {
              c = l;
              b = l;
              d = 19;
              break;
            }
          }
          f[c >> 2] = 0;
          c = f[k >> 2] | 0;
          d = 18;
        }
      while (0);
      if ((d | 0) == 18) {
        b = c;
        if (c) d = 19;
      }
      if ((d | 0) == 19) {
        c = f[(c + 4) >> 2] | 0;
        if (i) c = c & h;
        else c = ((c >>> 0) % (e >>> 0)) | 0;
        if ((c | 0) != (g | 0)) {
          f[((f[a >> 2] | 0) + (c << 2)) >> 2] = j;
          b = f[k >> 2] | 0;
        }
      }
      f[j >> 2] = b;
      f[k >> 2] = 0;
      a = (a + 12) | 0;
      f[a >> 2] = (f[a >> 2] | 0) + -1;
      if (!k) return l | 0;
      b = f[(k + 20) >> 2] | 0;
      if (b | 0) {
        c = (k + 24) | 0;
        if ((f[c >> 2] | 0) != (b | 0)) f[c >> 2] = b;
        Ns(b);
      }
      wq((k + 8) | 0);
      Ns(k);
      return l | 0;
    }
    function rh(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = u;
      u = (u + 16) | 0;
      j = (m + 4) | 0;
      k = m;
      l = (a + 8) | 0;
      g = (a + 100) | 0;
      h = f[l >> 2] | 0;
      h = ((f[(h + 28) >> 2] | 0) - (f[(h + 24) >> 2] | 0)) >> 2;
      f[j >> 2] = 0;
      d = (a + 104) | 0;
      c = f[d >> 2] | 0;
      b = f[g >> 2] | 0;
      i = (c - b) >> 2;
      if (h >>> 0 <= i >>> 0) {
        if (
          h >>> 0 < i >>> 0 ? ((e = (b + (h << 2)) | 0), (c | 0) != (e | 0)) : 0
        )
          f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
      } else Di(g, (h - i) | 0, j);
      d = (a + 120) | 0;
      b = f[d >> 2] | 0;
      if (!b) {
        a = f[l >> 2] | 0;
        a = ((f[(a + 4) >> 2] | 0) - (f[a >> 2] | 0)) >> 2;
        b = ((a >>> 0) / 3) | 0;
        if (a >>> 0 <= 2) {
          u = m;
          return 1;
        }
        c = 0;
        do {
          f[k >> 2] = c * 3;
          f[j >> 2] = f[k >> 2];
          Qb(l, j);
          c = (c + 1) | 0;
        } while ((c | 0) < (b | 0));
        u = m;
        return 1;
      } else {
        c = f[b >> 2] | 0;
        if ((f[(b + 4) >> 2] | 0) == (c | 0)) {
          u = m;
          return 1;
        }
        b = 0;
        do {
          f[k >> 2] = f[(c + (b << 2)) >> 2];
          f[j >> 2] = f[k >> 2];
          Qb(l, j);
          b = (b + 1) | 0;
          a = f[d >> 2] | 0;
          c = f[a >> 2] | 0;
        } while (b >>> 0 < ((f[(a + 4) >> 2] | 0) - c) >> 2 >>> 0);
        u = m;
        return 1;
      }
      return 0;
    }
    function sh(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0;
      g = (a + 124) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 128) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      g = (a + 112) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 116) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      b = f[(a + 100) >> 2] | 0;
      if (b | 0) {
        d = (a + 104) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 88) >> 2] | 0;
      if (!b) {
        h = (a + 68) | 0;
        Om(h);
        h = (a + 48) | 0;
        Om(h);
        h = (a + 28) | 0;
        Om(h);
        a = (a + 12) | 0;
        Ss(a);
        return;
      }
      d = (a + 92) | 0;
      c = f[d >> 2] | 0;
      if ((c | 0) != (b | 0))
        f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
      Ns(b);
      h = (a + 68) | 0;
      Om(h);
      h = (a + 48) | 0;
      Om(h);
      h = (a + 28) | 0;
      Om(h);
      a = (a + 12) | 0;
      Ss(a);
      return;
    }
    function th(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      k = u;
      u = (u + 112) | 0;
      h = (k + 96) | 0;
      j = (k + 16) | 0;
      i = (k + 4) | 0;
      g = k;
      c = (j + 76) | 0;
      d = j;
      e = (d + 76) | 0;
      do {
        f[d >> 2] = 0;
        d = (d + 4) | 0;
      } while ((d | 0) < (e | 0));
      f[c >> 2] = -1073741824;
      f[i >> 2] = 0;
      e = (i + 4) | 0;
      f[e >> 2] = 0;
      f[(i + 8) >> 2] = 0;
      f[g >> 2] = i;
      f[h >> 2] = f[g >> 2];
      if (He(j, a, h) | 0) {
        g = f[i >> 2] | 0;
        ah(b, g, (g + (((f[e >> 2] | 0) - g) >> 2 << 2)) | 0);
        g = f[(j + 68) >> 2] | 0;
      } else g = 0;
      c = f[i >> 2] | 0;
      if (c | 0) {
        d = f[e >> 2] | 0;
        if ((d | 0) != (c | 0))
          f[e >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
        Ns(c);
      }
      c = f[(j + 56) >> 2] | 0;
      if (c | 0) Ns(c);
      c = f[(j + 32) >> 2] | 0;
      if (c | 0) {
        e = (j + 36) | 0;
        d = f[e >> 2] | 0;
        if ((d | 0) != (c | 0))
          f[e >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
        Ns(c);
      }
      c = f[(j + 20) >> 2] | 0;
      if (c | 0) {
        e = (j + 24) | 0;
        d = f[e >> 2] | 0;
        if ((d | 0) != (c | 0))
          f[e >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
        Ns(c);
      }
      c = f[(j + 8) >> 2] | 0;
      if (c | 0) {
        e = (j + 12) | 0;
        d = f[e >> 2] | 0;
        if ((d | 0) != (c | 0))
          f[e >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
        Ns(c);
      }
      j = (j + 4) | 0;
      c = f[j >> 2] | 0;
      f[j >> 2] = 0;
      if (!c) {
        u = k;
        return g | 0;
      }
      Vk(c);
      Ns(c);
      u = k;
      return g | 0;
    }
    function uh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      l = u;
      u = (u + 32) | 0;
      i = (l + 16) | 0;
      k = l;
      f[i >> 2] = 0;
      do
        if ((j[(b + 38) >> 1] | 0) < 514) {
          n = (b + 8) | 0;
          m = f[n >> 2] | 0;
          n = f[(n + 4) >> 2] | 0;
          g = (b + 16) | 0;
          c = g;
          e = f[c >> 2] | 0;
          c = sq(e | 0, f[(c + 4) >> 2] | 0, 4, 0) | 0;
          d = I;
          if (
            ((n | 0) < (d | 0)) |
            (((n | 0) == (d | 0)) & (m >>> 0 < c >>> 0))
          ) {
            n = 0;
            u = l;
            return n | 0;
          } else {
            n = ((f[b >> 2] | 0) + e) | 0;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            f[i >> 2] = n;
            m = g;
            f[m >> 2] = c;
            f[(m + 4) >> 2] = d;
            c = n;
            break;
          }
        } else if (_k(i, b) | 0) {
          c = f[i >> 2] | 0;
          break;
        } else {
          n = 0;
          u = l;
          return n | 0;
        }
      while (0);
      e = (a + 60) | 0;
      jg(e, c, 0);
      is(k);
      if (lg(k, b) | 0) {
        if (f[i >> 2] | 0) {
          c = 0;
          d = 1;
          do {
            d = d ^ ((km(k) | 0) ^ 1);
            n = ((f[e >> 2] | 0) + (c >>> 5 << 2)) | 0;
            m = 1 << (c & 31);
            g = f[n >> 2] | 0;
            f[n >> 2] = d ? g | m : g & ~m;
            c = (c + 1) | 0;
          } while (c >>> 0 < (f[i >> 2] | 0) >>> 0);
        }
        c = Ij((a + 8) | 0, b) | 0;
      } else c = 0;
      Ss(k);
      n = c;
      u = l;
      return n | 0;
    }
    function vh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      f[c >> 2] = 1;
      e = (a + 4) | 0;
      l = (c + 8) | 0;
      k = (c + 12) | 0;
      c = f[l >> 2] | 0;
      d = ((f[k >> 2] | 0) - c) | 0;
      if (d >>> 0 < 4294967292) {
        im(l, (d + 4) | 0, 0);
        c = f[l >> 2] | 0;
      }
      j = (c + d) | 0;
      i =
        h[e >> 0] |
        (h[(e + 1) >> 0] << 8) |
        (h[(e + 2) >> 0] << 16) |
        (h[(e + 3) >> 0] << 24);
      b[j >> 0] = i;
      b[(j + 1) >> 0] = i >> 8;
      b[(j + 2) >> 0] = i >> 16;
      b[(j + 3) >> 0] = i >> 24;
      j = (a + 8) | 0;
      i = (a + 12) | 0;
      c = f[j >> 2] | 0;
      if ((f[i >> 2] | 0) != (c | 0)) {
        g = 0;
        do {
          d = (c + (g << 2)) | 0;
          c = f[l >> 2] | 0;
          e = ((f[k >> 2] | 0) - c) | 0;
          if (e >>> 0 < 4294967292) {
            im(l, (e + 4) | 0, 0);
            c = f[l >> 2] | 0;
          }
          c = (c + e) | 0;
          e =
            h[d >> 0] |
            (h[(d + 1) >> 0] << 8) |
            (h[(d + 2) >> 0] << 16) |
            (h[(d + 3) >> 0] << 24);
          b[c >> 0] = e;
          b[(c + 1) >> 0] = e >> 8;
          b[(c + 2) >> 0] = e >> 16;
          b[(c + 3) >> 0] = e >> 24;
          g = (g + 1) | 0;
          c = f[j >> 2] | 0;
        } while (g >>> 0 < ((f[i >> 2] | 0) - c) >> 2 >>> 0);
      }
      e = (a + 20) | 0;
      d = f[l >> 2] | 0;
      c = ((f[k >> 2] | 0) - d) | 0;
      if (c >>> 0 < 4294967292) {
        im(l, (c + 4) | 0, 0);
        l = f[l >> 2] | 0;
        l = (l + c) | 0;
        k =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[l >> 0] = k;
        b[(l + 1) >> 0] = k >> 8;
        b[(l + 2) >> 0] = k >> 16;
        b[(l + 3) >> 0] = k >> 24;
        return;
      } else {
        l = d;
        l = (l + c) | 0;
        k =
          h[e >> 0] |
          (h[(e + 1) >> 0] << 8) |
          (h[(e + 2) >> 0] << 16) |
          (h[(e + 3) >> 0] << 24);
        b[l >> 0] = k;
        b[(l + 1) >> 0] = k >> 8;
        b[(l + 2) >> 0] = k >> 16;
        b[(l + 3) >> 0] = k >> 24;
        return;
      }
    }
    function wh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      k = c;
      i = b;
      j = (k - i) | 0;
      g = j >> 2;
      h = (a + 8) | 0;
      d = f[h >> 2] | 0;
      l = f[a >> 2] | 0;
      m = l;
      if (g >>> 0 <= (d - l) >> 2 >>> 0) {
        j = (a + 4) | 0;
        e = ((f[j >> 2] | 0) - l) >> 2;
        h = g >>> 0 > e >>> 0;
        g = h ? (b + (e << 2)) | 0 : c;
        e = g;
        c = (e - i) | 0;
        d = c >> 2;
        if (d | 0) _n(l | 0, b | 0, c | 0) | 0;
        c = (m + (d << 2)) | 0;
        if (h) {
          d = (k - e) | 0;
          if ((d | 0) <= 0) return;
          li(f[j >> 2] | 0, g | 0, d | 0) | 0;
          f[j >> 2] = (f[j >> 2] | 0) + (d >>> 2 << 2);
          return;
        } else {
          d = f[j >> 2] | 0;
          if ((d | 0) == (c | 0)) return;
          f[j >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
          return;
        }
      }
      e = l;
      if (l) {
        c = (a + 4) | 0;
        d = f[c >> 2] | 0;
        if ((d | 0) != (m | 0))
          f[c >> 2] = d + (~(((d + -4 - l) | 0) >>> 2) << 2);
        Ns(e);
        f[h >> 2] = 0;
        f[c >> 2] = 0;
        f[a >> 2] = 0;
        d = 0;
      }
      if (g >>> 0 > 1073741823) {
        xr(a);
        c = f[a >> 2] | 0;
        d = f[h >> 2] | 0;
      } else c = 0;
      m = (d - c) | 0;
      d = m >> 1;
      d = m >> 2 >>> 0 < 536870911 ? (d >>> 0 < g >>> 0 ? g : d) : 1073741823;
      if (d >>> 0 > 1073741823) {
        xr(a);
        b = Ia(4) | 0;
        ps(b);
        sa(b | 0, 1488, 137);
      }
      e = Xo(d << 2) | 0;
      c = (a + 4) | 0;
      f[c >> 2] = e;
      f[a >> 2] = e;
      f[h >> 2] = e + (d << 2);
      if ((j | 0) <= 0) return;
      li(e | 0, b | 0, j | 0) | 0;
      f[c >> 2] = e + (j >>> 2 << 2);
      return;
    }
    function xh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      l = u;
      u = (u + 32) | 0;
      i = (l + 16) | 0;
      k = l;
      f[i >> 2] = 0;
      do
        if ((j[(b + 38) >> 1] | 0) < 514) {
          n = (b + 8) | 0;
          m = f[n >> 2] | 0;
          n = f[(n + 4) >> 2] | 0;
          g = (b + 16) | 0;
          c = g;
          e = f[c >> 2] | 0;
          c = sq(e | 0, f[(c + 4) >> 2] | 0, 4, 0) | 0;
          d = I;
          if (
            ((n | 0) < (d | 0)) |
            (((n | 0) == (d | 0)) & (m >>> 0 < c >>> 0))
          ) {
            n = 0;
            u = l;
            return n | 0;
          } else {
            n = ((f[b >> 2] | 0) + e) | 0;
            n =
              h[n >> 0] |
              (h[(n + 1) >> 0] << 8) |
              (h[(n + 2) >> 0] << 16) |
              (h[(n + 3) >> 0] << 24);
            f[i >> 2] = n;
            m = g;
            f[m >> 2] = c;
            f[(m + 4) >> 2] = d;
            c = n;
            break;
          }
        } else if (_k(i, b) | 0) {
          c = f[i >> 2] | 0;
          break;
        } else {
          n = 0;
          u = l;
          return n | 0;
        }
      while (0);
      e = (a + 60) | 0;
      jg(e, c, 0);
      is(k);
      if (lg(k, b) | 0) {
        if (f[i >> 2] | 0) {
          c = 0;
          d = 1;
          do {
            d = d ^ ((km(k) | 0) ^ 1);
            n = ((f[e >> 2] | 0) + (c >>> 5 << 2)) | 0;
            m = 1 << (c & 31);
            g = f[n >> 2] | 0;
            f[n >> 2] = d ? g | m : g & ~m;
            c = (c + 1) | 0;
          } while (c >>> 0 < (f[i >> 2] | 0) >>> 0);
        }
        c = fj((a + 8) | 0, b) | 0;
      } else c = 0;
      Ss(k);
      n = c;
      u = l;
      return n | 0;
    }
    function yh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      p = u;
      u = (u + 48) | 0;
      n = (p + 40) | 0;
      m = (p + 32) | 0;
      j = (p + 8) | 0;
      k = p;
      l = (p + 24) | 0;
      o = (p + 16) | 0;
      g = (a + 4) | 0;
      q = f[g >> 2] | 0;
      d = f[b >> 2] | 0;
      b = f[(b + 4) >> 2] | 0;
      e = c;
      h = f[e >> 2] | 0;
      e = f[(e + 4) >> 2] | 0;
      i = (h - d) << 3;
      f[g >> 2] = q - b + e + i;
      g = ((f[a >> 2] | 0) + (q >>> 5 << 2)) | 0;
      a = q & 31;
      c = g;
      if ((b | 0) != (a | 0)) {
        q = j;
        f[q >> 2] = d;
        f[(q + 4) >> 2] = b;
        q = k;
        f[q >> 2] = h;
        f[(q + 4) >> 2] = e;
        f[l >> 2] = c;
        f[(l + 4) >> 2] = a;
        f[m >> 2] = f[j >> 2];
        f[(m + 4) >> 2] = f[(j + 4) >> 2];
        f[n >> 2] = f[k >> 2];
        f[(n + 4) >> 2] = f[(k + 4) >> 2];
        Df(o, m, n, l);
        u = p;
        return;
      }
      e = (e - b + i) | 0;
      a = d;
      if ((e | 0) > 0) {
        if (!b) {
          h = a;
          c = e;
          b = 0;
        } else {
          h = (32 - b) | 0;
          c = (e | 0) < (h | 0) ? e : h;
          h = (-1 >>> ((h - c) | 0)) & (-1 << b);
          f[g >> 2] = (f[g >> 2] & ~h) | (f[a >> 2] & h);
          b = (c + b) | 0;
          h = (a + 4) | 0;
          g = (g + (b >>> 5 << 2)) | 0;
          d = h;
          c = (e - c) | 0;
          b = b & 31;
        }
        e = c >>> 5;
        _n(g | 0, d | 0, (e << 2) | 0) | 0;
        d = (c - (e << 5)) | 0;
        a = (g + (e << 2)) | 0;
        c = a;
        if ((d | 0) > 0) {
          b = -1 >>> ((32 - d) | 0);
          f[a >> 2] = (f[a >> 2] & ~b) | (f[(h + (e << 2)) >> 2] & b);
          b = d;
        }
      }
      f[o >> 2] = c;
      f[(o + 4) >> 2] = b;
      u = p;
      return;
    }
    function zh(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0;
      v = u;
      u = (u + 16) | 0;
      s = v;
      e = f[(a + 40) >> 2] | 0;
      j = f[(a + 44) >> 2] | 0;
      if ((e | 0) == (j | 0)) {
        t = 0;
        u = v;
        return t | 0;
      }
      k = (s + 11) | 0;
      m = (s + 4) | 0;
      l = (d + 11) | 0;
      n = (d + 4) | 0;
      a = e;
      a: while (1) {
        f[s >> 2] = 0;
        f[(s + 4) >> 2] = 0;
        f[(s + 8) >> 2] = 0;
        do
          if (
            Hk(f[a >> 2] | 0, c, s) | 0
              ? (
                  (p = b[k >> 0] | 0),
                  (q = p << 24 >> 24 < 0),
                  (p = p & 255),
                  (o = q ? f[m >> 2] | 0 : p),
                  (i = b[l >> 0] | 0),
                  (r = i << 24 >> 24 < 0),
                  (o | 0) == ((r ? f[n >> 2] | 0 : i & 255) | 0)
                )
              : 0
          ) {
            g = f[s >> 2] | 0;
            i = q ? g : s;
            e = r ? f[d >> 2] | 0 : d;
            h = (o | 0) == 0;
            if (q) {
              if (h) break a;
              if (!(Wm(i, e, o) | 0)) break a;
              else break;
            }
            if (h) break a;
            if ((g & 255) << 24 >> 24 == (b[e >> 0] | 0)) {
              g = p;
              h = s;
              do {
                g = (g + -1) | 0;
                h = (h + 1) | 0;
                if (!g) break a;
                e = (e + 1) | 0;
              } while ((b[h >> 0] | 0) == (b[e >> 0] | 0));
            }
          }
        while (0);
        wq(s);
        a = (a + 4) | 0;
        if ((a | 0) == (j | 0)) {
          a = 0;
          t = 14;
          break;
        }
      }
      if ((t | 0) == 14) {
        u = v;
        return a | 0;
      }
      t = f[a >> 2] | 0;
      wq(s);
      u = v;
      return t | 0;
    }
    function Ah(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      e = f[d >> 2] | 0;
      m = f[(d + 4) >> 2] | 0;
      a: do
        if ((e | 0) == (m | 0)) {
          n = (a + 8) | 0;
          o = (a + 12) | 0;
          q = 0;
        } else {
          k = f[c >> 2] | 0;
          l = (a + 8) | 0;
          j = (a + 12) | 0;
          d = 0;
          b: while (1) {
            h = f[e >> 2] | 0;
            i = f[(k + (h << 2)) >> 2] | 0;
            if ((i | 0) >= (d | 0)) {
              d = f[l >> 2] | 0;
              c = ((f[j >> 2] | 0) - d) | 0;
              if ((c | 0) > 0) {
                g = c >> 2;
                a = 0;
                do {
                  c = f[(d + (a << 2)) >> 2] | 0;
                  if (b[(c + 84) >> 0] | 0) break b;
                  c = f[(c + 68) >> 2] | 0;
                  f[(c + (i << 2)) >> 2] = f[(c + (h << 2)) >> 2];
                  a = (a + 1) | 0;
                } while ((a | 0) < (g | 0));
              }
              d = (i + 1) | 0;
            }
            e = (e + 4) | 0;
            if ((e | 0) == (m | 0)) {
              n = l;
              o = j;
              q = d;
              break a;
            }
          }
          Ga(21891, 21910, 89, 22004);
        }
      while (0);
      c = f[o >> 2] | 0;
      d = f[n >> 2] | 0;
      if (((c - d) | 0) > 0) j = 0;
      else return;
      do {
        g = f[(d + (j << 2)) >> 2] | 0;
        b[(g + 84) >> 0] = 0;
        h = (g + 68) | 0;
        g = (g + 72) | 0;
        e = f[g >> 2] | 0;
        a = f[h >> 2] | 0;
        i = (e - a) >> 2;
        if (q >>> 0 <= i >>> 0) {
          if (
            q >>> 0 < i >>> 0
              ? ((p = (a + (q << 2)) | 0), (e | 0) != (p | 0))
              : 0
          )
            f[g >> 2] = e + (~(((e + -4 - p) | 0) >>> 2) << 2);
        } else {
          Di(h, (q - i) | 0, 5152);
          d = f[n >> 2] | 0;
          c = f[o >> 2] | 0;
        }
        j = (j + 1) | 0;
      } while ((j | 0) < (((c - d) >> 2) | 0));
      return;
    }
    function Bh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = La,
        g = La,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = La,
        x = La,
        y = 0,
        z = 0;
      v = u;
      u = (u + 16) | 0;
      p = v;
      m = f[(a + 24) >> 2] | 0;
      r = (a + 8) | 0;
      d = b[((f[r >> 2] | 0) + 24) >> 0] | 0;
      o = d << 24 >> 24;
      t = o << 2;
      s = Ks(o >>> 0 > 1073741823 ? -1 : o << 2) | 0;
      hr(p);
      pp(p, $(n[(a + 32) >> 2]), ((1 << m) + -1) | 0);
      m = f[(a + 16) >> 2] | 0;
      m = ((f[f[m >> 2] >> 2] | 0) + (f[(m + 48) >> 2] | 0)) | 0;
      if (!c) {
        Ls(s);
        u = v;
        return 1;
      }
      q = (p + 4) | 0;
      l = (a + 28) | 0;
      if (d << 24 >> 24 > 0) {
        h = 0;
        i = 0;
        j = 0;
      } else {
        a = 0;
        d = 0;
        while (1) {
          li(
            ((f[f[((f[r >> 2] | 0) + 64) >> 2] >> 2] | 0) + d) | 0,
            s | 0,
            t | 0
          ) | 0;
          a = (a + 1) | 0;
          if ((a | 0) == (c | 0)) break;
          else d = (d + t) | 0;
        }
        Ls(s);
        u = v;
        return 1;
      }
      while (1) {
        a = f[l >> 2] | 0;
        e = $(n[q >> 2]);
        g = $(n[p >> 2]);
        d = 0;
        k = j;
        while (1) {
          z = f[(m + (k << 2)) >> 2] | 0;
          y = (z | 0) < 0;
          w = $(e * $((y ? (0 - z) | 0 : z) | 0));
          x = $(-w);
          w = $(g * (y ? x : w));
          w = $($(n[(a + (d << 2)) >> 2]) + w);
          n[(s + (d << 2)) >> 2] = w;
          d = (d + 1) | 0;
          if ((d | 0) == (o | 0)) break;
          else k = (k + 1) | 0;
        }
        li(
          ((f[f[((f[r >> 2] | 0) + 64) >> 2] >> 2] | 0) + i) | 0,
          s | 0,
          t | 0
        ) | 0;
        h = (h + 1) | 0;
        if ((h | 0) == (c | 0)) break;
        else {
          i = (i + t) | 0;
          j = (o + j) | 0;
        }
      }
      Ls(s);
      u = v;
      return 1;
    }
    function Ch(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      j = d[b >> 1] | 0;
      k = d[(b + 2) >> 1] | 0;
      l = d[(b + 4) >> 1] | 0;
      i = d[(b + 6) >> 1] | 0;
      b =
        (((((((j ^ 318) & 65535) + 239) ^ (k & 65535)) + 239) ^ (l & 65535)) +
          239) ^
        (i & 65535);
      e = f[(a + 4) >> 2] | 0;
      if (!e) {
        l = 0;
        return l | 0;
      }
      h = (e + -1) | 0;
      c = ((h & e) | 0) == 0;
      if (c) g = b & h;
      else g = ((b >>> 0) % (e >>> 0)) | 0;
      b = f[((f[a >> 2] | 0) + (g << 2)) >> 2] | 0;
      if (!b) {
        l = 0;
        return l | 0;
      }
      b = f[b >> 2] | 0;
      if (!b) {
        l = 0;
        return l | 0;
      }
      if (c) {
        while (1) {
          if (((f[(b + 4) >> 2] & h) | 0) != (g | 0)) {
            b = 0;
            a = 20;
            break;
          }
          if (
            (((d[(b + 8) >> 1] | 0) == j << 16 >> 16
            ? (d[(b + 10) >> 1] | 0) == k << 16 >> 16
            : 0)
            ? (d[(b + 12) >> 1] | 0) == l << 16 >> 16
            : 0)
              ? (d[(b + 14) >> 1] | 0) == i << 16 >> 16
              : 0
          ) {
            a = 20;
            break;
          }
          b = f[b >> 2] | 0;
          if (!b) {
            b = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return b | 0;
      } else {
        while (1) {
          if (
            ((((f[(b + 4) >> 2] | 0) >>> 0) % (e >>> 0)) | 0 | 0) !=
            (g | 0)
          ) {
            b = 0;
            a = 20;
            break;
          }
          if (
            (((d[(b + 8) >> 1] | 0) == j << 16 >> 16
            ? (d[(b + 10) >> 1] | 0) == k << 16 >> 16
            : 0)
            ? (d[(b + 12) >> 1] | 0) == l << 16 >> 16
            : 0)
              ? (d[(b + 14) >> 1] | 0) == i << 16 >> 16
              : 0
          ) {
            a = 20;
            break;
          }
          b = f[b >> 2] | 0;
          if (!b) {
            b = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return b | 0;
      }
      return 0;
    }
    function Dh(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      k = (b + 16) | 0;
      l = f[k >> 2] | 0;
      g = ((f[c >> 2] | 0) - l) | 0;
      i = (c + 4) | 0;
      e = ((f[i >> 2] | 0) - l) | 0;
      j = c;
      f[j >> 2] = g;
      f[(j + 4) >> 2] = e;
      j = f[k >> 2] | 0;
      if ((j | 0) < (g | 0)) Ga(11106, 10407, 250, 11129);
      if ((j | 0) < (e | 0)) Ga(11141, 10407, 251, 11129);
      h = (0 - j) | 0;
      if ((g | 0) < (h | 0)) Ga(11164, 10407, 252, 11129);
      if ((e | 0) < (h | 0)) Ga(11188, 10407, 253, 11129);
      if (
        ((((e | 0) > -1 ? e : (0 - e) | 0) + ((g | 0) > -1 ? g : (0 - g) | 0)) |
          0) >
        (j | 0)
      ) {
        vj((b + 4) | 0, c, i);
        g = f[c >> 2] | 0;
        e = f[i >> 2] | 0;
        h = f[k >> 2] | 0;
        i = 0;
      } else {
        h = j;
        i = 1;
      }
      c = ((f[d >> 2] | 0) + g) | 0;
      f[a >> 2] = c;
      e = ((f[(d + 4) >> 2] | 0) + e) | 0;
      g = (a + 4) | 0;
      f[g >> 2] = e;
      if ((h | 0) >= (c | 0)) {
        if ((c | 0) < ((0 - h) | 0)) c = ((f[(b + 8) >> 2] | 0) + c) | 0;
      } else c = (c - (f[(b + 8) >> 2] | 0)) | 0;
      f[a >> 2] = c;
      if ((h | 0) >= (e | 0)) {
        if ((e | 0) < ((0 - h) | 0)) e = ((f[(b + 8) >> 2] | 0) + e) | 0;
      } else e = (e - (f[(b + 8) >> 2] | 0)) | 0;
      f[g >> 2] = e;
      if (i) {
        d = c;
        b = e;
        d = (d + l) | 0;
        l = (b + l) | 0;
        b = a;
        a = b;
        f[a >> 2] = d;
        b = (b + 4) | 0;
        f[b >> 2] = l;
        return;
      }
      vj((b + 4) | 0, a, g);
      d = f[a >> 2] | 0;
      b = f[g >> 2] | 0;
      d = (d + l) | 0;
      l = (b + l) | 0;
      b = a;
      a = b;
      f[a >> 2] = d;
      b = (b + 4) | 0;
      f[b >> 2] = l;
      return;
    }
    function Eh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      j = b[c >> 0] | 0;
      k = b[(c + 1) >> 0] | 0;
      l = b[(c + 2) >> 0] | 0;
      i = b[(c + 3) >> 0] | 0;
      c =
        (((((((j & 255) ^ 318) + 239) ^ (k & 255)) + 239) ^ (l & 255)) + 239) ^
        (i & 255);
      e = f[(a + 4) >> 2] | 0;
      if (!e) {
        l = 0;
        return l | 0;
      }
      h = (e + -1) | 0;
      d = ((h & e) | 0) == 0;
      if (d) g = c & h;
      else g = ((c >>> 0) % (e >>> 0)) | 0;
      c = f[((f[a >> 2] | 0) + (g << 2)) >> 2] | 0;
      if (!c) {
        l = 0;
        return l | 0;
      }
      c = f[c >> 2] | 0;
      if (!c) {
        l = 0;
        return l | 0;
      }
      if (d) {
        while (1) {
          if (((f[(c + 4) >> 2] & h) | 0) != (g | 0)) {
            c = 0;
            a = 20;
            break;
          }
          if (
            (((b[(c + 8) >> 0] | 0) == j << 24 >> 24
            ? (b[(c + 9) >> 0] | 0) == k << 24 >> 24
            : 0)
            ? (b[(c + 10) >> 0] | 0) == l << 24 >> 24
            : 0)
              ? (b[(c + 11) >> 0] | 0) == i << 24 >> 24
              : 0
          ) {
            a = 20;
            break;
          }
          c = f[c >> 2] | 0;
          if (!c) {
            c = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return c | 0;
      } else {
        while (1) {
          if (
            ((((f[(c + 4) >> 2] | 0) >>> 0) % (e >>> 0)) | 0 | 0) !=
            (g | 0)
          ) {
            c = 0;
            a = 20;
            break;
          }
          if (
            (((b[(c + 8) >> 0] | 0) == j << 24 >> 24
            ? (b[(c + 9) >> 0] | 0) == k << 24 >> 24
            : 0)
            ? (b[(c + 10) >> 0] | 0) == l << 24 >> 24
            : 0)
              ? (b[(c + 11) >> 0] | 0) == i << 24 >> 24
              : 0
          ) {
            a = 20;
            break;
          }
          c = f[c >> 2] | 0;
          if (!c) {
            c = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return c | 0;
      }
      return 0;
    }
    function Fh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = u;
      u = (u + 16) | 0;
      h = j;
      f[h >> 2] = b;
      if ((b | 0) <= -1) Ga(22021, 22033, 110, 22125);
      i = (a + 8) | 0;
      if (((((f[(a + 12) >> 2] | 0) - (f[i >> 2] | 0)) >> 2) | 0) <= (b | 0))
        Zi(i, (b + 1) | 0);
      d = f[((f[c >> 2] | 0) + 56) >> 2] | 0;
      do
        if ((d | 0) < 5) {
          g = (a + 20 + ((d * 12) | 0) + 4) | 0;
          e = f[g >> 2] | 0;
          if ((e | 0) == (f[(a + 20 + ((d * 12) | 0) + 8) >> 2] | 0)) {
            hk((a + 20 + ((d * 12) | 0)) | 0, h);
            break;
          } else {
            f[e >> 2] = b;
            f[g >> 2] = e + 4;
            break;
          }
        }
      while (0);
      g = f[c >> 2] | 0;
      a = f[h >> 2] | 0;
      f[(g + 60) >> 2] = a;
      a = ((f[i >> 2] | 0) + (a << 2)) | 0;
      f[c >> 2] = 0;
      b = f[a >> 2] | 0;
      f[a >> 2] = g;
      if (!b) {
        u = j;
        return;
      }
      a = (b + 88) | 0;
      d = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (d | 0) {
        e = f[(d + 8) >> 2] | 0;
        if (e | 0) {
          g = (d + 12) | 0;
          if ((f[g >> 2] | 0) != (e | 0)) f[g >> 2] = e;
          Ns(e);
        }
        Ns(d);
      }
      d = f[(b + 68) >> 2] | 0;
      if (d | 0) {
        g = (b + 72) | 0;
        e = f[g >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[g >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      a = (b + 64) | 0;
      d = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (d | 0) {
        e = f[d >> 2] | 0;
        if (e | 0) {
          g = (d + 4) | 0;
          if ((f[g >> 2] | 0) != (e | 0)) f[g >> 2] = e;
          Ns(e);
        }
        Ns(d);
      }
      Ns(b);
      u = j;
      return;
    }
    function Gh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0;
      n = (c + 8) | 0;
      m = f[n >> 2] | 0;
      n = f[(n + 4) >> 2] | 0;
      q = (c + 16) | 0;
      o = q;
      p = f[o >> 2] | 0;
      o = f[(o + 4) >> 2] | 0;
      e = sq(p | 0, o | 0, 4, 0) | 0;
      d = I;
      if (((n | 0) < (d | 0)) | (((n | 0) == (d | 0)) & (m >>> 0 < e >>> 0))) {
        a = 0;
        return a | 0;
      }
      l = f[c >> 2] | 0;
      g = (l + p) | 0;
      g =
        h[g >> 0] |
        (h[(g + 1) >> 0] << 8) |
        (h[(g + 2) >> 0] << 16) |
        (h[(g + 3) >> 0] << 24);
      i = q;
      f[i >> 2] = e;
      f[(i + 4) >> 2] = d;
      i = sq(p | 0, o | 0, 8, 0) | 0;
      k = I;
      if (((n | 0) < (k | 0)) | (((n | 0) == (k | 0)) & (m >>> 0 < i >>> 0))) {
        a = 0;
        return a | 0;
      }
      d = (l + e) | 0;
      d =
        h[d >> 0] |
        (h[(d + 1) >> 0] << 8) |
        (h[(d + 2) >> 0] << 16) |
        (h[(d + 3) >> 0] << 24);
      e = q;
      f[e >> 2] = i;
      f[(e + 4) >> 2] = k;
      f[(a + 12) >> 2] = g;
      f[(a + 16) >> 2] = d;
      g = (d + (1 - g)) | 0;
      f[(a + 20) >> 2] = g;
      d = ((g | 0) / 2) | 0;
      e = (a + 24) | 0;
      f[e >> 2] = d;
      f[(a + 28) >> 2] = 0 - d;
      if (!(g & 1)) f[e >> 2] = d + -1;
      do
        if ((j[(c + 38) >> 1] | 0) < 514) {
          if (
            !(
              ((n | 0) > (k | 0)) |
              (((n | 0) == (k | 0)) & (m >>> 0 > i >>> 0))
            )
          ) {
            a = 0;
            return a | 0;
          }
          d = b[(l + i) >> 0] | 0;
          p = sq(p | 0, o | 0, 9, 0) | 0;
          f[q >> 2] = p;
          f[(q + 4) >> 2] = I;
          if ((d & 255) < 2) {
            f[(a + 88) >> 2] = d & 255;
            break;
          } else {
            a = 0;
            return a | 0;
          }
        }
      while (0);
      a = lg((a + 108) | 0, c) | 0;
      return a | 0;
    }
    function Hh(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      j = c;
      h = (d - j) | 0;
      i = (a + 8) | 0;
      e = f[i >> 2] | 0;
      g = f[a >> 2] | 0;
      k = g;
      if (h >>> 0 > ((e - g) | 0) >>> 0) {
        if (g) {
          e = (a + 4) | 0;
          if ((f[e >> 2] | 0) != (k | 0)) f[e >> 2] = k;
          Ns(k);
          f[i >> 2] = 0;
          f[e >> 2] = 0;
          f[a >> 2] = 0;
          e = 0;
        }
        if ((h | 0) < 0) {
          xr(a);
          e = f[i >> 2] | 0;
          g = f[a >> 2] | 0;
        } else g = 0;
        k = (e - g) | 0;
        g = k << 1;
        g = k >>> 0 < 1073741823 ? (g >>> 0 < h >>> 0 ? h : g) : 2147483647;
        if ((g | 0) < 0) xr(a);
        e = Xo(g) | 0;
        h = (a + 4) | 0;
        f[h >> 2] = e;
        f[a >> 2] = e;
        f[i >> 2] = e + g;
        if ((c | 0) == (d | 0)) return;
        do {
          b[e >> 0] = b[c >> 0] | 0;
          c = (c + 1) | 0;
          e = ((f[h >> 2] | 0) + 1) | 0;
          f[h >> 2] = e;
        } while ((c | 0) != (d | 0));
        return;
      } else {
        a = (a + 4) | 0;
        i = ((f[a >> 2] | 0) - g) | 0;
        h = h >>> 0 > i >>> 0;
        i = (c + i) | 0;
        g = h ? i : d;
        e = (g - j) | 0;
        if (e | 0) _n(k | 0, c | 0, e | 0) | 0;
        c = (k + e) | 0;
        if (!h) {
          if ((f[a >> 2] | 0) == (c | 0)) return;
          f[a >> 2] = c;
          return;
        }
        if ((g | 0) == (d | 0)) return;
        e = f[a >> 2] | 0;
        c = i;
        do {
          b[e >> 0] = b[c >> 0] | 0;
          c = (c + 1) | 0;
          e = ((f[a >> 2] | 0) + 1) | 0;
          f[a >> 2] = e;
        } while ((c | 0) != (d | 0));
        return;
      }
    }
    function Ih(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      k = u;
      u = (u + 32) | 0;
      i = (k + 16) | 0;
      h = k;
      if ((j[(c + 38) >> 1] | 0) < 514) {
        l = (c + 8) | 0;
        m = f[(l + 4) >> 2] | 0;
        g = (c + 16) | 0;
        d = g;
        e = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        if (
          !(
            ((m | 0) > (d | 0)) |
            ((m | 0) == (d | 0) ? (f[l >> 2] | 0) >>> 0 > e >>> 0 : 0)
          )
        ) {
          m = 0;
          u = k;
          return m | 0;
        }
        m = b[((f[c >> 2] | 0) + e) >> 0] | 0;
        e = sq(e | 0, d | 0, 1, 0) | 0;
        l = g;
        f[l >> 2] = e;
        f[(l + 4) >> 2] = I;
        if (m << 24 >> 24) {
          m = 0;
          u = k;
          return m | 0;
        }
      }
      g = 0;
      do {
        _k(i, c) | 0;
        d = f[i >> 2] | 0;
        if (d | 0) {
          e = (a + 44 + ((g * 12) | 0)) | 0;
          jg(e, d, 0);
          is(h);
          lg(h, c) | 0;
          if (f[i >> 2] | 0) {
            d = 0;
            do {
              o = km(h) | 0;
              m = ((f[e >> 2] | 0) + (d >>> 5 << 2)) | 0;
              l = 1 << (d & 31);
              n = f[m >> 2] | 0;
              f[m >> 2] = o ? n | l : n & ~l;
              d = (d + 1) | 0;
            } while (d >>> 0 < (f[i >> 2] | 0) >>> 0);
          }
          Ss(h);
        }
        g = (g + 1) | 0;
      } while ((g | 0) < 4);
      o = Ij((a + 8) | 0, c) | 0;
      u = k;
      return o | 0;
    }
    function Jh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = (a + 8) | 0;
      e = f[n >> 2] | 0;
      m = (a + 4) | 0;
      d = f[m >> 2] | 0;
      if ((e - d) >> 2 >>> 0 >= b >>> 0) {
        Gk(d | 0, 0, (b << 2) | 0) | 0;
        f[m >> 2] = d + (b << 2);
        return;
      }
      c = f[a >> 2] | 0;
      h = (((d - c) >> 2) + b) | 0;
      if (h >>> 0 > 1073741823) {
        xr(a);
        g = f[a >> 2] | 0;
        d = f[m >> 2] | 0;
        e = f[n >> 2] | 0;
      } else g = c;
      c = d;
      l = g;
      k = (e - g) | 0;
      j = k >> 1;
      h = k >> 2 >>> 0 < 536870911 ? (j >>> 0 < h >>> 0 ? h : j) : 1073741823;
      j = (d - g) >> 2;
      do
        if (h)
          if (h >>> 0 > 1073741823) {
            a = Ia(4) | 0;
            ps(a);
            sa(a | 0, 1488, 137);
          } else {
            i = Xo(h << 2) | 0;
            break;
          }
        else i = 0;
      while (0);
      e = (i + (j << 2)) | 0;
      Gk(e | 0, 0, (b << 2) | 0) | 0;
      d = e;
      k = (i + (h << 2)) | 0;
      h = (i + ((j + b) << 2)) | 0;
      if ((c | 0) != (l | 0)) {
        do {
          c = (c + -4) | 0;
          b = f[c >> 2] | 0;
          f[c >> 2] = 0;
          f[(e + -4) >> 2] = b;
          e = (d + -4) | 0;
          d = e;
        } while ((c | 0) != (l | 0));
        g = f[a >> 2] | 0;
        c = f[m >> 2] | 0;
      }
      f[a >> 2] = d;
      f[m >> 2] = h;
      f[n >> 2] = k;
      e = g;
      if ((c | 0) != (e | 0))
        do {
          c = (c + -4) | 0;
          d = f[c >> 2] | 0;
          f[c >> 2] = 0;
          if (d | 0) Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
        } while ((c | 0) != (e | 0));
      if (!g) return;
      Ns(g);
      return;
    }
    function Kh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      i = f[b >> 2] | 0;
      j = f[(b + 4) >> 2] | 0;
      k = f[(b + 8) >> 2] | 0;
      h = f[(b + 12) >> 2] | 0;
      b = ((((((i ^ 318) + 239) ^ j) + 239) ^ k) + 239) ^ h;
      d = f[(a + 4) >> 2] | 0;
      if (!d) {
        k = 0;
        return k | 0;
      }
      g = (d + -1) | 0;
      c = ((g & d) | 0) == 0;
      if (c) e = b & g;
      else e = ((b >>> 0) % (d >>> 0)) | 0;
      b = f[((f[a >> 2] | 0) + (e << 2)) >> 2] | 0;
      if (!b) {
        k = 0;
        return k | 0;
      }
      b = f[b >> 2] | 0;
      if (!b) {
        k = 0;
        return k | 0;
      }
      if (c) {
        while (1) {
          if (((f[(b + 4) >> 2] & g) | 0) != (e | 0)) {
            b = 0;
            a = 20;
            break;
          }
          if (
            (((f[(b + 8) >> 2] | 0) == (i | 0)
            ? (f[(b + 12) >> 2] | 0) == (j | 0)
            : 0)
            ? (f[(b + 16) >> 2] | 0) == (k | 0)
            : 0)
              ? (f[(b + 20) >> 2] | 0) == (h | 0)
              : 0
          ) {
            a = 20;
            break;
          }
          b = f[b >> 2] | 0;
          if (!b) {
            b = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return b | 0;
      } else {
        while (1) {
          if (
            ((((f[(b + 4) >> 2] | 0) >>> 0) % (d >>> 0)) | 0 | 0) !=
            (e | 0)
          ) {
            b = 0;
            a = 20;
            break;
          }
          if (
            (((f[(b + 8) >> 2] | 0) == (i | 0)
            ? (f[(b + 12) >> 2] | 0) == (j | 0)
            : 0)
            ? (f[(b + 16) >> 2] | 0) == (k | 0)
            : 0)
              ? (f[(b + 20) >> 2] | 0) == (h | 0)
              : 0
          ) {
            a = 20;
            break;
          }
          b = f[b >> 2] | 0;
          if (!b) {
            b = 0;
            a = 20;
            break;
          }
        }
        if ((a | 0) == 20) return b | 0;
      }
      return 0;
    }
    function Lh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      k = u;
      u = (u + 32) | 0;
      i = (k + 16) | 0;
      h = k;
      if ((j[(c + 38) >> 1] | 0) < 514) {
        l = (c + 8) | 0;
        m = f[(l + 4) >> 2] | 0;
        g = (c + 16) | 0;
        d = g;
        e = f[d >> 2] | 0;
        d = f[(d + 4) >> 2] | 0;
        if (
          !(
            ((m | 0) > (d | 0)) |
            ((m | 0) == (d | 0) ? (f[l >> 2] | 0) >>> 0 > e >>> 0 : 0)
          )
        ) {
          m = 0;
          u = k;
          return m | 0;
        }
        m = b[((f[c >> 2] | 0) + e) >> 0] | 0;
        e = sq(e | 0, d | 0, 1, 0) | 0;
        l = g;
        f[l >> 2] = e;
        f[(l + 4) >> 2] = I;
        if (m << 24 >> 24) {
          m = 0;
          u = k;
          return m | 0;
        }
      }
      g = 0;
      do {
        _k(i, c) | 0;
        d = f[i >> 2] | 0;
        if (d | 0) {
          e = (a + 44 + ((g * 12) | 0)) | 0;
          jg(e, d, 0);
          is(h);
          lg(h, c) | 0;
          if (f[i >> 2] | 0) {
            d = 0;
            do {
              o = km(h) | 0;
              m = ((f[e >> 2] | 0) + (d >>> 5 << 2)) | 0;
              l = 1 << (d & 31);
              n = f[m >> 2] | 0;
              f[m >> 2] = o ? n | l : n & ~l;
              d = (d + 1) | 0;
            } while (d >>> 0 < (f[i >> 2] | 0) >>> 0);
          }
          Ss(h);
        }
        g = (g + 1) | 0;
      } while ((g | 0) < 4);
      o = fj((a + 8) | 0, c) | 0;
      u = k;
      return o | 0;
    }
    function Mh(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      l = u;
      u = (u + 32) | 0;
      k = (l + 16) | 0;
      g = (l + 12) | 0;
      h = (l + 8) | 0;
      i = (l + 4) | 0;
      j = l;
      e = f[(c + 4) >> 2] | 0;
      if (!e) Ga(11762, 11970, 62, 12190);
      c = f[(c + 8) >> 2] | 0;
      if (!c) Ga(11762, 11970, 62, 12190);
      c = f[(c + (d << 2)) >> 2] | 0;
      if (!(b[(e + 84) >> 0] | 0))
        c = f[((f[(e + 68) >> 2] | 0) + (c << 2)) >> 2] | 0;
      f[a >> 2] = 0;
      f[(a + 4) >> 2] = 0;
      f[(a + 8) >> 2] = 0;
      f[(a + 12) >> 2] = 0;
      f[(a + 16) >> 2] = 0;
      f[(a + 20) >> 2] = 0;
      switch (b[(e + 24) >> 0] | 0) {
        case 1: {
          f[g >> 2] = c;
          f[k >> 2] = f[g >> 2];
          re(e, k, a) | 0;
          u = l;
          return;
        }
        case 2: {
          f[h >> 2] = c;
          f[k >> 2] = f[h >> 2];
          qe(e, k, a) | 0;
          u = l;
          return;
        }
        case 3: {
          f[i >> 2] = c;
          f[k >> 2] = f[i >> 2];
          pe(e, k, a) | 0;
          u = l;
          return;
        }
        case 4: {
          f[j >> 2] = c;
          f[k >> 2] = f[j >> 2];
          oe(e, k, a) | 0;
          u = l;
          return;
        }
        default: {
          u = l;
          return;
        }
      }
    }
    function Nh(a) {
      a = a | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      c = f[(a + 32) >> 2] | 0;
      h = (c + 8) | 0;
      j = f[(h + 4) >> 2] | 0;
      g = (c + 16) | 0;
      d = g;
      e = f[d >> 2] | 0;
      d = f[(d + 4) >> 2] | 0;
      if (
        !(
          ((j | 0) > (d | 0)) |
          ((j | 0) == (d | 0) ? (f[h >> 2] | 0) >>> 0 > e >>> 0 : 0)
        )
      ) {
        j = 0;
        return j | 0;
      }
      h = b[((f[c >> 2] | 0) + e) >> 0] | 0;
      c = sq(e | 0, d | 0, 1, 0) | 0;
      e = g;
      f[e >> 2] = c;
      f[(e + 4) >> 2] = I;
      e = (a + 48) | 0;
      c = f[e >> 2] | 0;
      f[e >> 2] = 0;
      if (c | 0) Pa[f[((f[c >> 2] | 0) + 4) >> 2] & 255](c);
      switch (h << 24 >> 24) {
        case 0: {
          c = Xo(392) | 0;
          wl(c);
          d = f[e >> 2] | 0;
          f[e >> 2] = c;
          if (d) {
            Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
            i = 11;
          }
          break;
        }
        case 1: {
          c = Xo(432) | 0;
          Jk(c);
          d = f[e >> 2] | 0;
          f[e >> 2] = c;
          if (d) {
            Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
            i = 11;
          }
          break;
        }
        case 2: {
          c = Xo(448) | 0;
          kk(c);
          d = f[e >> 2] | 0;
          f[e >> 2] = c;
          if (d) {
            Pa[f[((f[d >> 2] | 0) + 4) >> 2] & 255](d);
            i = 11;
          }
          break;
        }
        default:
          i = 11;
      }
      if ((i | 0) == 11) {
        c = f[e >> 2] | 0;
        if (!c) {
          j = 0;
          return j | 0;
        }
      }
      j = Wa[f[((f[c >> 2] | 0) + 8) >> 2] & 127](c, a) | 0;
      return j | 0;
    }
    function Oh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0;
      f[(a + 4) >> 2] = f[(b + 4) >> 2];
      g = (a + 8) | 0;
      i = (b + 8) | 0;
      if ((a | 0) == (b | 0)) return a | 0;
      h = (b + 12) | 0;
      c = f[h >> 2] | 0;
      if (!c) c = 0;
      else {
        e = (a + 16) | 0;
        if (c >>> 0 > f[e >> 2] << 5 >>> 0) {
          d = f[g >> 2] | 0;
          if (d) {
            Ns(d);
            f[g >> 2] = 0;
            f[e >> 2] = 0;
            f[(a + 12) >> 2] = 0;
            c = f[h >> 2] | 0;
          }
          if ((c | 0) < 0) xr(g);
          d = ((((c + -1) | 0) >>> 5) + 1) | 0;
          c = Xo(d << 2) | 0;
          f[g >> 2] = c;
          f[(a + 12) >> 2] = 0;
          f[e >> 2] = d;
          d = f[h >> 2] | 0;
        } else {
          d = c;
          c = f[g >> 2] | 0;
        }
        _n(c | 0, f[i >> 2] | 0, ((((d + -1) | 0) >>> 5 << 2) + 4) | 0) | 0;
        c = f[h >> 2] | 0;
      }
      f[(a + 12) >> 2] = c;
      h = (a + 20) | 0;
      i = (b + 20) | 0;
      g = (b + 24) | 0;
      c = f[g >> 2] | 0;
      if (!c) c = 0;
      else {
        e = (a + 28) | 0;
        if (c >>> 0 > f[e >> 2] << 5 >>> 0) {
          d = f[h >> 2] | 0;
          if (d) {
            Ns(d);
            f[h >> 2] = 0;
            f[e >> 2] = 0;
            f[(a + 24) >> 2] = 0;
            c = f[g >> 2] | 0;
          }
          if ((c | 0) < 0) xr(h);
          d = ((((c + -1) | 0) >>> 5) + 1) | 0;
          c = Xo(d << 2) | 0;
          f[h >> 2] = c;
          f[(a + 24) >> 2] = 0;
          f[e >> 2] = d;
          d = f[g >> 2] | 0;
        } else {
          d = c;
          c = f[h >> 2] | 0;
        }
        _n(c | 0, f[i >> 2] | 0, ((((d + -1) | 0) >>> 5 << 2) + 4) | 0) | 0;
        c = f[g >> 2] | 0;
      }
      f[(a + 24) >> 2] = c;
      return a | 0;
    }
    function Ph(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      j = (a + 8) | 0;
      g = f[j >> 2] | 0;
      k = (a + 4) | 0;
      d = f[k >> 2] | 0;
      if (((((g - d) | 0) / 12) | 0) >>> 0 >= b >>> 0) {
        do {
          f[d >> 2] = f[c >> 2];
          f[(d + 4) >> 2] = f[(c + 4) >> 2];
          f[(d + 8) >> 2] = f[(c + 8) >> 2];
          d = ((f[k >> 2] | 0) + 12) | 0;
          f[k >> 2] = d;
          b = (b + -1) | 0;
        } while ((b | 0) != 0);
        return;
      }
      e = f[a >> 2] | 0;
      h = (((((d - e) | 0) / 12) | 0) + b) | 0;
      if (h >>> 0 > 357913941) {
        xr(a);
        e = f[a >> 2] | 0;
        g = f[j >> 2] | 0;
        d = f[k >> 2] | 0;
      }
      i = (((g - e) | 0) / 12) | 0;
      g = i << 1;
      g = i >>> 0 < 178956970 ? (g >>> 0 < h >>> 0 ? h : g) : 357913941;
      d = (((d - e) | 0) / 12) | 0;
      do
        if (g)
          if (g >>> 0 > 357913941) {
            k = Ia(4) | 0;
            ps(k);
            sa(k | 0, 1488, 137);
          } else {
            e = Xo((g * 12) | 0) | 0;
            break;
          }
        else e = 0;
      while (0);
      i = (e + ((d * 12) | 0)) | 0;
      h = (e + ((g * 12) | 0)) | 0;
      d = i;
      g = i;
      do {
        f[d >> 2] = f[c >> 2];
        f[(d + 4) >> 2] = f[(c + 4) >> 2];
        f[(d + 8) >> 2] = f[(c + 8) >> 2];
        d = (g + 12) | 0;
        g = d;
        b = (b + -1) | 0;
      } while ((b | 0) != 0);
      d = f[a >> 2] | 0;
      e = ((f[k >> 2] | 0) - d) | 0;
      b = (i + (((((e | 0) / -12) | 0) * 12) | 0)) | 0;
      if ((e | 0) > 0) li(b | 0, d | 0, e | 0) | 0;
      f[a >> 2] = b;
      f[k >> 2] = g;
      f[j >> 2] = h;
      if (!d) return;
      Ns(d);
      return;
    }
    function Qh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0;
      a = (a + 20) | 0;
      if (be(a, b) | 0) {
        e = 0;
        return e | 0;
      }
      d = tc(a, b) | 0;
      b = f[c >> 2] | 0;
      f[c >> 2] = 0;
      e = f[d >> 2] | 0;
      f[d >> 2] = b;
      if (!e) {
        e = 1;
        return e | 0;
      }
      a = f[(e + 28) >> 2] | 0;
      if (a | 0)
        do {
          d = a;
          a = f[a >> 2] | 0;
          Nj((d + 8) | 0);
          Ns(d);
        } while ((a | 0) != 0);
      d = (e + 20) | 0;
      a = f[d >> 2] | 0;
      f[d >> 2] = 0;
      if (a | 0) Ns(a);
      a = f[(e + 8) >> 2] | 0;
      if (a | 0)
        do {
          d = a;
          a = f[a >> 2] | 0;
          b = f[(d + 20) >> 2] | 0;
          if (b | 0) {
            c = (d + 24) | 0;
            if ((f[c >> 2] | 0) != (b | 0)) f[c >> 2] = b;
            Ns(b);
          }
          wq((d + 8) | 0);
          Ns(d);
        } while ((a | 0) != 0);
      a = f[e >> 2] | 0;
      f[e >> 2] = 0;
      if (a | 0) Ns(a);
      Ns(e);
      e = 1;
      return e | 0;
    }
    function Rh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0;
      c = (a + 8) | 0;
      f[c >> 2] = f[b >> 2];
      Oh((a + 12) | 0, (b + 4) | 0) | 0;
      d = (a + 44) | 0;
      e = (b + 36) | 0;
      f[d >> 2] = f[e >> 2];
      f[(d + 4) >> 2] = f[(e + 4) >> 2];
      f[(d + 8) >> 2] = f[(e + 8) >> 2];
      f[(d + 12) >> 2] = f[(e + 12) >> 2];
      if ((c | 0) == (b | 0)) {
        f[(a + 96) >> 2] = f[(b + 88) >> 2];
        return;
      } else {
        ih((a + 60) | 0, f[(b + 52) >> 2] | 0, f[(b + 56) >> 2] | 0);
        ih((a + 72) | 0, f[(b + 64) >> 2] | 0, f[(b + 68) >> 2] | 0);
        ih((a + 84) | 0, f[(b + 76) >> 2] | 0, f[(b + 80) >> 2] | 0);
        f[(a + 96) >> 2] = f[(b + 88) >> 2];
        wh((a + 100) | 0, f[(b + 92) >> 2] | 0, f[(b + 96) >> 2] | 0);
        return;
      }
    }
    function Sh(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = u;
      u = (u + 80) | 0;
      g = j;
      i = (j + 64) | 0;
      rn(g);
      e = f[((f[(a + 8) >> 2] | 0) + 56) >> 2] | 0;
      h = X(Ln(5) | 0, d) | 0;
      Zk(g, e, 0, d & 255, 5, 0, h, ((h | 0) < 0) << 31 >> 31, 0, 0);
      h = Xo(96) | 0;
      dn(h, g);
      b[(h + 84) >> 0] = 1;
      d = f[(h + 68) >> 2] | 0;
      g = (h + 72) | 0;
      e = f[g >> 2] | 0;
      if ((e | 0) != (d | 0))
        f[g >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
      Sk(h, c) | 0;
      f[i >> 2] = h;
      tk(a, i);
      h = f[i >> 2] | 0;
      f[i >> 2] = 0;
      if (!h) {
        u = j;
        return;
      }
      i = (h + 88) | 0;
      d = f[i >> 2] | 0;
      f[i >> 2] = 0;
      if (d | 0) {
        e = f[(d + 8) >> 2] | 0;
        if (e | 0) {
          g = (d + 12) | 0;
          if ((f[g >> 2] | 0) != (e | 0)) f[g >> 2] = e;
          Ns(e);
        }
        Ns(d);
      }
      d = f[(h + 68) >> 2] | 0;
      if (d | 0) {
        g = (h + 72) | 0;
        e = f[g >> 2] | 0;
        if ((e | 0) != (d | 0))
          f[g >> 2] = e + (~(((e + -4 - d) | 0) >>> 2) << 2);
        Ns(d);
      }
      i = (h + 64) | 0;
      d = f[i >> 2] | 0;
      f[i >> 2] = 0;
      if (d | 0) {
        e = f[d >> 2] | 0;
        if (e | 0) {
          g = (d + 4) | 0;
          if ((f[g >> 2] | 0) != (e | 0)) f[g >> 2] = e;
          Ns(e);
        }
        Ns(d);
      }
      Ns(h);
      u = j;
      return;
    }
    function Th(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0;
      f[a >> 2] = 5124;
      b = f[(a + 68) >> 2] | 0;
      if (b | 0) {
        d = (a + 72) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      c = f[(a + 56) >> 2] | 0;
      if (c | 0) {
        d = (a + 60) | 0;
        b = f[d >> 2] | 0;
        if ((b | 0) != (c | 0))
          f[d >> 2] = b + (~(((b + -4 - c) | 0) >>> 2) << 2);
        Ns(c);
      }
      b = f[(a + 44) >> 2] | 0;
      if (b | 0) {
        d = (a + 48) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 32) >> 2] | 0;
      if (b | 0) {
        d = (a + 36) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      b = f[(a + 20) >> 2] | 0;
      if (b | 0) {
        d = (a + 24) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      Fj((a + 8) | 0);
      a = (a + 4) | 0;
      e = f[a >> 2] | 0;
      f[a >> 2] = 0;
      if (!e) return;
      d = (e + 40) | 0;
      b = f[d >> 2] | 0;
      if (b | 0) {
        a = (e + 44) | 0;
        c = f[a >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            g = (c + -4) | 0;
            f[a >> 2] = g;
            c = f[g >> 2] | 0;
            f[g >> 2] = 0;
            if (c | 0) {
              qk(c);
              Ns(c);
            }
            c = f[a >> 2] | 0;
          } while ((c | 0) != (b | 0));
          b = f[d >> 2] | 0;
        }
        Ns(b);
      }
      qk(e);
      Ns(e);
      return;
    }
    function Uh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = u;
      u = (u + 16) | 0;
      i = j;
      d = f[(a + 8) >> 2] | 0;
      e = f[c >> 2] | 0;
      h = ((e | 0) / 3) | 0;
      if ((e | 0) <= -3) Ga(22767, 22792, 63, 22869);
      g = f[(d + 96) >> 2] | 0;
      if ((h | 0) >= (((((f[(d + 100) >> 2] | 0) - g) | 0) / 12) | 0 | 0))
        Ga(22874, 22792, 64, 22869);
      h = f[(g + ((h * 12) | 0) + ((((e | 0) % 3) | 0) << 2)) >> 2] | 0;
      d = f[(a + 12) >> 2] | 0;
      f[i >> 2] = h;
      d = f[(d + 4) >> 2] | 0;
      g = (d + 4) | 0;
      e = f[g >> 2] | 0;
      if ((e | 0) == (f[(d + 8) >> 2] | 0)) hk(d, i);
      else {
        f[e >> 2] = h;
        f[g >> 2] = e + 4;
      }
      h = (a + 4) | 0;
      e = f[h >> 2] | 0;
      g = (e + 4) | 0;
      d = f[g >> 2] | 0;
      if ((d | 0) == (f[(e + 8) >> 2] | 0)) {
        hk(e, c);
        i = f[h >> 2] | 0;
        c = (i + 24) | 0;
        a = f[c >> 2] | 0;
        b = f[b >> 2] | 0;
        i = (i + 12) | 0;
        i = f[i >> 2] | 0;
        b = (i + (b << 2)) | 0;
        f[b >> 2] = a;
        b = f[c >> 2] | 0;
        b = (b + 1) | 0;
        f[c >> 2] = b;
        u = j;
        return;
      } else {
        f[d >> 2] = f[c >> 2];
        f[g >> 2] = d + 4;
        i = e;
        c = (i + 24) | 0;
        a = f[c >> 2] | 0;
        b = f[b >> 2] | 0;
        i = (i + 12) | 0;
        i = f[i >> 2] | 0;
        b = (i + (b << 2)) | 0;
        f[b >> 2] = a;
        b = f[c >> 2] | 0;
        b = (b + 1) | 0;
        f[c >> 2] = b;
        u = j;
        return;
      }
    }
    function Vh(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 16) | 0;
      o = (p + 4) | 0;
      n = p;
      f[(a + 56) >> 2] = e;
      f[(a + 48) >> 2] = g;
      l = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      m = (a + 52) | 0;
      d = f[m >> 2] | 0;
      f[m >> 2] = l;
      if (d | 0) Ls(d);
      j = (a + 40) | 0;
      g = f[j >> 2] | 0;
      h = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      l = (h - d) | 0;
      k = l >> 2;
      if ((l | 0) <= 0) {
        u = p;
        return 1;
      }
      l = (a + 8) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((i - d) >> 2 >>> 0 <= h >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[n >> 2] = f[(d + (h << 2)) >> 2];
        f[o >> 2] = f[n >> 2];
        Jc(a, o, c, h);
        i = X(h, e) | 0;
        Hj(l, f[m >> 2] | 0, (b + (i << 2)) | 0, (c + (i << 2)) | 0);
        h = (h + 1) | 0;
        if ((h | 0) >= (k | 0)) break;
        i = f[j >> 2] | 0;
        g = i;
        d = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
      }
      u = p;
      return 1;
    }
    function Wh(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      n = u;
      u = (u + 16) | 0;
      m = n;
      d = Um(c, 0) | 0;
      if (!d) {
        f[a >> 2] = 0;
        u = n;
        return;
      }
      l = (c + 96) | 0;
      e = (c + 100) | 0;
      cl(m, ((((f[e >> 2] | 0) - (f[l >> 2] | 0)) | 0) / 12) | 0);
      c = f[l >> 2] | 0;
      e = ((f[e >> 2] | 0) - c) | 0;
      if ((e | 0) > 0) {
        l = (d + 68) | 0;
        k = f[m >> 2] | 0;
        j = (b[(d + 84) >> 0] | 0) == 0;
        i = ((e | 0) / 12) | 0;
        h = 0;
        do {
          d = (c + ((h * 12) | 0)) | 0;
          if (j) {
            o = f[l >> 2] | 0;
            e = (o + (f[(c + ((h * 12) | 0) + 8) >> 2] << 2)) | 0;
            g = (o + (f[(c + ((h * 12) | 0) + 4) >> 2] << 2)) | 0;
            d = (o + (f[d >> 2] << 2)) | 0;
          } else {
            e = (c + ((h * 12) | 0) + 8) | 0;
            g = (c + ((h * 12) | 0) + 4) | 0;
          }
          g = f[g >> 2] | 0;
          o = f[e >> 2] | 0;
          f[(k + ((h * 12) | 0)) >> 2] = f[d >> 2];
          f[(k + ((h * 12) | 0) + 4) >> 2] = g;
          f[(k + ((h * 12) | 0) + 8) >> 2] = o;
          h = (h + 1) | 0;
        } while ((h | 0) < (i | 0));
      }
      Ql(a, m);
      e = f[m >> 2] | 0;
      if (e | 0) {
        d = (m + 4) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (e | 0))
          f[d >> 2] =
            c + ((~(((((c + -12 - e) | 0) >>> 0) / 12) | 0) * 12) | 0);
        Ns(e);
      }
      u = n;
      return;
    }
    function Xh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      n = u;
      u = (u + 32) | 0;
      i = (n + 24) | 0;
      j = (n + 16) | 0;
      k = (n + 8) | 0;
      m = n;
      l = (a + 4) | 0;
      o = f[l >> 2] | 0;
      e = f[b >> 2] | 0;
      b = f[(b + 4) >> 2] | 0;
      h = f[c >> 2] | 0;
      d = f[(c + 4) >> 2] | 0;
      g = (h - e) << 3;
      f[l >> 2] = o - b + d + g;
      l = ((f[a >> 2] | 0) + (o >>> 5 << 2)) | 0;
      a = o & 31;
      c = l;
      if ((b | 0) != (a | 0)) {
        f[i >> 2] = e;
        f[(i + 4) >> 2] = b;
        f[j >> 2] = h;
        f[(j + 4) >> 2] = d;
        f[k >> 2] = c;
        f[(k + 4) >> 2] = a;
        Zf(m, i, j, k);
        u = n;
        return;
      }
      d = (d - b + g) | 0;
      a = e;
      if ((d | 0) > 0) {
        if (!b) {
          h = a;
          c = d;
          a = l;
          b = 0;
        } else {
          h = (32 - b) | 0;
          c = (d | 0) < (h | 0) ? d : h;
          h = (-1 >>> ((h - c) | 0)) & (-1 << b);
          f[l >> 2] = (f[l >> 2] & ~h) | (f[a >> 2] & h);
          b = (c + b) | 0;
          h = (a + 4) | 0;
          e = h;
          c = (d - c) | 0;
          a = (l + (b >>> 5 << 2)) | 0;
          b = b & 31;
        }
        g = c >>> 5;
        _n(a | 0, e | 0, (g << 2) | 0) | 0;
        d = (c - (g << 5)) | 0;
        a = (a + (g << 2)) | 0;
        c = a;
        if ((d | 0) > 0) {
          b = -1 >>> ((32 - d) | 0);
          f[a >> 2] = (f[a >> 2] & ~b) | (f[(h + (g << 2)) >> 2] & b);
          b = d;
        }
      }
      f[m >> 2] = c;
      f[(m + 4) >> 2] = b;
      u = n;
      return;
    }
    function Yh(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0;
      l = (a + 4) | 0;
      d = f[l >> 2] | 0;
      c = f[a >> 2] | 0;
      e = (((d - c) >> 2) + 1) | 0;
      if (e >>> 0 > 1073741823) {
        xr(a);
        c = f[a >> 2] | 0;
        d = f[l >> 2] | 0;
      }
      k = (a + 8) | 0;
      j = ((f[k >> 2] | 0) - c) | 0;
      g = j >> 1;
      g = j >> 2 >>> 0 < 536870911 ? (g >>> 0 < e >>> 0 ? e : g) : 1073741823;
      c = (d - c) >> 2;
      do
        if (g)
          if (g >>> 0 > 1073741823) {
            a = Ia(4) | 0;
            ps(a);
            sa(a | 0, 1488, 137);
          } else {
            e = Xo(g << 2) | 0;
            break;
          }
        else e = 0;
      while (0);
      h = (e + (c << 2)) | 0;
      d = h;
      j = (e + (g << 2)) | 0;
      i = f[b >> 2] | 0;
      f[b >> 2] = 0;
      f[h >> 2] = i;
      i = (h + 4) | 0;
      b = f[a >> 2] | 0;
      c = f[l >> 2] | 0;
      if ((c | 0) == (b | 0)) {
        g = b;
        c = b;
      } else {
        e = h;
        do {
          c = (c + -4) | 0;
          h = f[c >> 2] | 0;
          f[c >> 2] = 0;
          f[(e + -4) >> 2] = h;
          e = (d + -4) | 0;
          d = e;
        } while ((c | 0) != (b | 0));
        g = f[a >> 2] | 0;
        c = f[l >> 2] | 0;
      }
      f[a >> 2] = d;
      f[l >> 2] = i;
      f[k >> 2] = j;
      e = g;
      if ((c | 0) != (e | 0))
        do {
          c = (c + -4) | 0;
          d = f[c >> 2] | 0;
          f[c >> 2] = 0;
          if (d | 0) {
            qk(d);
            Ns(d);
          }
        } while ((c | 0) != (e | 0));
      if (!g) return;
      Ns(g);
      return;
    }
    function Zh(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      j = u;
      u = (u + 16) | 0;
      i = j;
      g = f[c >> 2] | 0;
      f[c >> 2] = 0;
      f[i >> 2] = g;
      Fh(a, b, i);
      g = f[i >> 2] | 0;
      f[i >> 2] = 0;
      if (g | 0) {
        i = (g + 88) | 0;
        c = f[i >> 2] | 0;
        f[i >> 2] = 0;
        if (c | 0) {
          d = f[(c + 8) >> 2] | 0;
          if (d | 0) {
            e = (c + 12) | 0;
            if ((f[e >> 2] | 0) != (d | 0)) f[e >> 2] = d;
            Ns(d);
          }
          Ns(c);
        }
        c = f[(g + 68) >> 2] | 0;
        if (c | 0) {
          e = (g + 72) | 0;
          d = f[e >> 2] | 0;
          if ((d | 0) != (c | 0))
            f[e >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
          Ns(c);
        }
        i = (g + 64) | 0;
        c = f[i >> 2] | 0;
        f[i >> 2] = 0;
        if (c | 0) {
          d = f[c >> 2] | 0;
          if (d | 0) {
            e = (c + 4) | 0;
            if ((f[e >> 2] | 0) != (d | 0)) f[e >> 2] = d;
            Ns(d);
          }
          Ns(c);
        }
        Ns(g);
      }
      i = (a + 84) | 0;
      h = (a + 88) | 0;
      c = f[h >> 2] | 0;
      g = f[i >> 2] | 0;
      a = (c - g) >> 2;
      if ((a | 0) > (b | 0)) {
        u = j;
        return;
      }
      e = (b + 1) | 0;
      d = c;
      if (e >>> 0 > a >>> 0) {
        Ji(i, (e - a) | 0);
        u = j;
        return;
      }
      if (e >>> 0 >= a >>> 0) {
        u = j;
        return;
      }
      c = (g + (e << 2)) | 0;
      if ((d | 0) == (c | 0)) {
        u = j;
        return;
      }
      f[h >> 2] = d + (~(((d + -4 - c) | 0) >>> 2) << 2);
      u = j;
      return;
    }
    function _h(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      a = (a + 4) | 0;
      e = f[a >> 2] | 0;
      if (!e) {
        f[c >> 2] = a;
        n = a;
        return n | 0;
      }
      l = b[(d + 11) >> 0] | 0;
      k = l << 24 >> 24 < 0;
      l = k ? f[(d + 4) >> 2] | 0 : l & 255;
      k = k ? f[d >> 2] | 0 : d;
      while (1) {
        g = (e + 16) | 0;
        d = b[(g + 11) >> 0] | 0;
        i = d << 24 >> 24 < 0;
        d = i ? f[(e + 20) >> 2] | 0 : d & 255;
        h = d >>> 0 < l >>> 0;
        a = h ? d : l;
        if (
          (a | 0) != 0
            ? ((n = Wm(k, i ? f[g >> 2] | 0 : g, a) | 0), (n | 0) != 0)
            : 0
        )
          if ((n | 0) < 0) j = 7;
          else j = 9;
        else if (l >>> 0 < d >>> 0) j = 7;
        else j = 9;
        if ((j | 0) == 7) {
          a = f[e >> 2] | 0;
          if (!a) {
            j = 8;
            break;
          }
        } else if ((j | 0) == 9) {
          j = 0;
          a = l >>> 0 < d >>> 0 ? l : d;
          if (
            (a | 0) != 0
              ? ((m = Wm(i ? f[g >> 2] | 0 : g, k, a) | 0), (m | 0) != 0)
              : 0
          ) {
            if ((m | 0) >= 0) {
              j = 16;
              break;
            }
          } else j = 11;
          if ((j | 0) == 11 ? (0, !h) : 0) {
            j = 16;
            break;
          }
          d = (e + 4) | 0;
          a = f[d >> 2] | 0;
          if (!a) {
            j = 15;
            break;
          }
        }
        e = a;
      }
      if ((j | 0) == 8) {
        f[c >> 2] = e;
        n = e;
        return n | 0;
      } else if ((j | 0) == 15) {
        f[c >> 2] = e;
        n = d;
        return n | 0;
      } else if ((j | 0) == 16) {
        f[c >> 2] = e;
        n = c;
        return n | 0;
      }
      return 0;
    }
    function $h(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0;
      e = f[c >> 2] | 0;
      h = f[a >> 2] | 0;
      j = (h + (e >>> 5 << 2)) | 0;
      f[j >> 2] = f[j >> 2] | (1 << (e & 31));
      j = f[(a + 64) >> 2] | 0;
      g = (e | 0) < 0;
      c = (e + 1) | 0;
      if (
        !g
          ? (
              (d = (((c | 0) % 3) | 0 | 0) == 0 ? (e + -2) | 0 : c),
              (d | 0) >= 0
            )
          : 0
      )
        c = f[((f[j >> 2] | 0) + (d << 2)) >> 2] | 0;
      else c = -1073741824;
      i = (a + 12) | 0;
      d = ((f[i >> 2] | 0) + (c >>> 5 << 2)) | 0;
      f[d >> 2] = f[d >> 2] | (1 << (c & 31));
      if (g) {
        j = ((f[i >> 2] | 0) + 402653184) | 0;
        f[j >> 2] = f[j >> 2] | 1;
        return;
      }
      c = (((((e >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + e) | 0;
      if ((c | 0) < 0) c = -1073741824;
      else c = f[((f[j >> 2] | 0) + (c << 2)) >> 2] | 0;
      d = ((f[i >> 2] | 0) + (c >>> 5 << 2)) | 0;
      f[d >> 2] = f[d >> 2] | (1 << (c & 31));
      if (g) return;
      d = f[((f[(j + 12) >> 2] | 0) + (e << 2)) >> 2] | 0;
      if ((d | 0) <= -1) return;
      b[(a + 24) >> 0] = 0;
      c = (h + (d >>> 5 << 2)) | 0;
      f[c >> 2] = f[c >> 2] | (1 << (d & 31));
      c = (d + 1) | 0;
      c = (((c | 0) % 3) | 0 | 0) == 0 ? (d + -2) | 0 : c;
      if ((c | 0) < 0) c = -1073741824;
      else c = f[((f[j >> 2] | 0) + (c << 2)) >> 2] | 0;
      a = ((f[i >> 2] | 0) + (c >>> 5 << 2)) | 0;
      f[a >> 2] = f[a >> 2] | (1 << (c & 31));
      c = (((((d >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + d) | 0;
      if ((c | 0) < 0) c = -1073741824;
      else c = f[((f[j >> 2] | 0) + (c << 2)) >> 2] | 0;
      j = ((f[i >> 2] | 0) + (c >>> 5 << 2)) | 0;
      f[j >> 2] = f[j >> 2] | (1 << (c & 31));
      return;
    }
    function ai(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = (a + 4) | 0;
      c = f[n >> 2] | 0;
      m = f[a >> 2] | 0;
      g = m;
      do
        if ((c | 0) == (m | 0)) {
          m = (a + 8) | 0;
          d = f[m >> 2] | 0;
          l = (a + 12) | 0;
          k = f[l >> 2] | 0;
          e = k;
          if (d >>> 0 < k >>> 0) {
            a = d;
            i = (((((e - a) >> 2) + 1) | 0) / 2) | 0;
            g = (d + (i << 2)) | 0;
            e = (a - c) | 0;
            a = e >> 2;
            h = (g + ((0 - a) << 2)) | 0;
            if (!a) c = g;
            else {
              _n(h | 0, c | 0, e | 0) | 0;
              d = f[m >> 2] | 0;
              c = h;
            }
            f[n >> 2] = c;
            f[m >> 2] = d + (i << 2);
            break;
          }
          e = (e - g) >> 1;
          e = (e | 0) == 0 ? 1 : e;
          if (e >>> 0 > 1073741823) {
            b = Ia(4) | 0;
            ps(b);
            sa(b | 0, 1488, 137);
          }
          h = Xo(e << 2) | 0;
          i = h;
          k = (h + (((e + 3) | 0) >>> 2 << 2)) | 0;
          j = k;
          h = (h + (e << 2)) | 0;
          if ((c | 0) == (d | 0)) d = j;
          else {
            e = k;
            g = j;
            do {
              f[e >> 2] = f[c >> 2];
              e = (g + 4) | 0;
              g = e;
              c = (c + 4) | 0;
            } while ((c | 0) != (d | 0));
            c = f[a >> 2] | 0;
            d = g;
          }
          f[a >> 2] = i;
          f[n >> 2] = j;
          f[m >> 2] = d;
          f[l >> 2] = h;
          if (!c) c = k;
          else {
            Ns(c);
            c = f[n >> 2] | 0;
          }
        }
      while (0);
      f[(c + -4) >> 2] = f[b >> 2];
      f[n >> 2] = (f[n >> 2] | 0) + -4;
      return;
    }
    function bi(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 16) | 0;
      o = (p + 4) | 0;
      n = p;
      f[(a + 56) >> 2] = e;
      f[(a + 48) >> 2] = g;
      l = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      m = (a + 52) | 0;
      d = f[m >> 2] | 0;
      f[m >> 2] = l;
      if (d | 0) Ls(d);
      j = (a + 40) | 0;
      g = f[j >> 2] | 0;
      h = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      l = (h - d) | 0;
      k = l >> 2;
      if ((l | 0) <= 0) {
        u = p;
        return 1;
      }
      l = (a + 8) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((i - d) >> 2 >>> 0 <= h >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[n >> 2] = f[(d + (h << 2)) >> 2];
        f[o >> 2] = f[n >> 2];
        Gc(a, o, c, h);
        i = X(h, e) | 0;
        Hj(l, f[m >> 2] | 0, (b + (i << 2)) | 0, (c + (i << 2)) | 0);
        h = (h + 1) | 0;
        if ((h | 0) >= (k | 0)) break;
        i = f[j >> 2] | 0;
        g = i;
        d = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
      }
      u = p;
      return 1;
    }
    function ci(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 16) | 0;
      o = (p + 4) | 0;
      n = p;
      f[(a + 56) >> 2] = e;
      f[(a + 48) >> 2] = g;
      l = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      m = (a + 52) | 0;
      d = f[m >> 2] | 0;
      f[m >> 2] = l;
      if (d | 0) Ls(d);
      j = (a + 40) | 0;
      g = f[j >> 2] | 0;
      h = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      l = (h - d) | 0;
      k = l >> 2;
      if ((l | 0) <= 0) {
        u = p;
        return 1;
      }
      l = (a + 8) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((i - d) >> 2 >>> 0 <= h >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[n >> 2] = f[(d + (h << 2)) >> 2];
        f[o >> 2] = f[n >> 2];
        Jc(a, o, c, h);
        i = X(h, e) | 0;
        Kj(l, f[m >> 2] | 0, (b + (i << 2)) | 0, (c + (i << 2)) | 0);
        h = (h + 1) | 0;
        if ((h | 0) >= (k | 0)) break;
        i = f[j >> 2] | 0;
        g = i;
        d = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
      }
      u = p;
      return 1;
    }
    function di(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      m = u;
      u = (u + 48) | 0;
      j = (m + 32) | 0;
      e = (m + 28) | 0;
      g = (m + 24) | 0;
      h = (m + 20) | 0;
      i = (m + 16) | 0;
      l = m;
      k = b[(a + 24) >> 0] | 0;
      f[l >> 2] = f[1289];
      f[(l + 4) >> 2] = f[1290];
      f[(l + 8) >> 2] = f[1291];
      f[(l + 12) >> 2] = f[1292];
      k = k << 24 >> 24;
      switch (k | 0) {
        case 1: {
          f[e >> 2] = c;
          f[j >> 2] = f[e >> 2];
          e = ze(a, j, l) | 0;
          break;
        }
        case 2: {
          f[g >> 2] = c;
          f[j >> 2] = f[g >> 2];
          e = ye(a, j, l) | 0;
          break;
        }
        case 3: {
          f[h >> 2] = c;
          f[j >> 2] = f[h >> 2];
          e = xe(a, j, l) | 0;
          break;
        }
        case 4: {
          f[i >> 2] = c;
          f[j >> 2] = f[i >> 2];
          e = we(a, j, l) | 0;
          break;
        }
        default: {
          l = 0;
          u = m;
          return l | 0;
        }
      }
      if (!e) {
        l = 0;
        u = m;
        return l | 0;
      }
      $g(d, l, (l + (k << 2)) | 0);
      l = 1;
      u = m;
      return l | 0;
    }
    function ei(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      i = u;
      u = (u + 16) | 0;
      g = (i + 4) | 0;
      h = i;
      b = f[b >> 2] | 0;
      if ((b | 0) < 0) {
        a = -1073741824;
        u = i;
        return a | 0;
      }
      d = (a + 4) | 0;
      c = f[d >> 2] | 0;
      e = f[((f[(c + 12) >> 2] | 0) + (b << 2)) >> 2] | 0;
      if ((e | 0) < 0) {
        a = -1073741824;
        u = i;
        return a | 0;
      }
      k = (b + 1) | 0;
      f[h >> 2] = (((k | 0) % 3) | 0 | 0) == 0 ? (b + -2) | 0 : k;
      k = f[a >> 2] | 0;
      f[g >> 2] = f[h >> 2];
      k = Zl(g, c, k) | 0;
      f[h >> 2] = ((((e >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + e;
      j = f[d >> 2] | 0;
      c = f[a >> 2] | 0;
      f[g >> 2] = f[h >> 2];
      if ((k | 0) != (Zl(g, j, c) | 0)) {
        k = -1073741824;
        u = i;
        return k | 0;
      }
      f[h >> 2] = b + ((((b >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1);
      j = f[d >> 2] | 0;
      c = f[a >> 2] | 0;
      f[g >> 2] = f[h >> 2];
      c = Zl(g, j, c) | 0;
      j = (e + 1) | 0;
      f[h >> 2] = (((j | 0) % 3) | 0 | 0) == 0 ? (e + -2) | 0 : j;
      j = f[d >> 2] | 0;
      k = f[a >> 2] | 0;
      f[g >> 2] = f[h >> 2];
      k = (c | 0) != (Zl(g, j, k) | 0);
      k = k ? -1073741824 : e;
      u = i;
      return k | 0;
    }
    function fi(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      n = (a + 8) | 0;
      c = f[n >> 2] | 0;
      l = (a + 12) | 0;
      m = f[l >> 2] | 0;
      e = m;
      h = c;
      do
        if ((c | 0) == (m | 0)) {
          m = (a + 4) | 0;
          k = f[m >> 2] | 0;
          d = f[a >> 2] | 0;
          g = d;
          if (k >>> 0 > d >>> 0) {
            c = k;
            g = (((((c - g) >> 2) + 1) | 0) / -2) | 0;
            e = (k + (g << 2)) | 0;
            c = (h - c) | 0;
            d = c >> 2;
            if (!d) c = k;
            else {
              _n(e | 0, k | 0, c | 0) | 0;
              c = f[m >> 2] | 0;
            }
            a = (e + (d << 2)) | 0;
            f[n >> 2] = a;
            f[m >> 2] = c + (g << 2);
            c = a;
            break;
          }
          e = (e - g) >> 1;
          e = (e | 0) == 0 ? 1 : e;
          if (e >>> 0 > 1073741823) {
            b = Ia(4) | 0;
            ps(b);
            sa(b | 0, 1488, 137);
          }
          h = Xo(e << 2) | 0;
          i = h;
          g = (h + (e >>> 2 << 2)) | 0;
          j = g;
          h = (h + (e << 2)) | 0;
          if ((k | 0) == (c | 0)) c = j;
          else {
            e = g;
            d = k;
            g = j;
            do {
              f[e >> 2] = f[d >> 2];
              e = (g + 4) | 0;
              g = e;
              d = (d + 4) | 0;
            } while ((d | 0) != (c | 0));
            d = f[a >> 2] | 0;
            c = g;
          }
          f[a >> 2] = i;
          f[m >> 2] = j;
          f[n >> 2] = c;
          f[l >> 2] = h;
          if (d) {
            Ns(d);
            c = f[n >> 2] | 0;
          }
        }
      while (0);
      f[c >> 2] = f[b >> 2];
      f[n >> 2] = (f[n >> 2] | 0) + 4;
      return;
    }
    function gi(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0;
      p = u;
      u = (u + 16) | 0;
      o = (p + 4) | 0;
      n = p;
      f[(a + 56) >> 2] = e;
      f[(a + 48) >> 2] = g;
      l = Ks(e >>> 0 > 1073741823 ? -1 : e << 2) | 0;
      m = (a + 52) | 0;
      d = f[m >> 2] | 0;
      f[m >> 2] = l;
      if (d | 0) Ls(d);
      j = (a + 40) | 0;
      g = f[j >> 2] | 0;
      h = f[(g + 4) >> 2] | 0;
      d = f[g >> 2] | 0;
      l = (h - d) | 0;
      k = l >> 2;
      if ((l | 0) <= 0) {
        u = p;
        return 1;
      }
      l = (a + 8) | 0;
      i = h;
      h = 0;
      while (1) {
        if ((i - d) >> 2 >>> 0 <= h >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[n >> 2] = f[(d + (h << 2)) >> 2];
        f[o >> 2] = f[n >> 2];
        Gc(a, o, c, h);
        i = X(h, e) | 0;
        Kj(l, f[m >> 2] | 0, (b + (i << 2)) | 0, (c + (i << 2)) | 0);
        h = (h + 1) | 0;
        if ((h | 0) >= (k | 0)) break;
        i = f[j >> 2] | 0;
        g = i;
        d = f[i >> 2] | 0;
        i = f[(i + 4) >> 2] | 0;
      }
      u = p;
      return 1;
    }
    function hi(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        k = 0,
        l = 0;
      do
        if (c) {
          if ((j[(a + 38) >> 1] | 0) >= 514) {
            if (vk(d, a) | 0) break;
            else c = 0;
            return c | 0;
          }
          l = (a + 8) | 0;
          i = f[l >> 2] | 0;
          l = f[(l + 4) >> 2] | 0;
          e = (a + 16) | 0;
          g = e;
          c = f[g >> 2] | 0;
          g = sq(c | 0, f[(g + 4) >> 2] | 0, 8, 0) | 0;
          k = I;
          if (
            ((l | 0) < (k | 0)) |
            (((l | 0) == (k | 0)) & (i >>> 0 < g >>> 0))
          ) {
            l = 0;
            return l | 0;
          } else {
            l = ((f[a >> 2] | 0) + c) | 0;
            g = l;
            g =
              h[g >> 0] |
              (h[(g + 1) >> 0] << 8) |
              (h[(g + 2) >> 0] << 16) |
              (h[(g + 3) >> 0] << 24);
            l = (l + 4) | 0;
            l =
              h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24);
            k = d;
            i = k;
            b[i >> 0] = g;
            b[(i + 1) >> 0] = g >> 8;
            b[(i + 2) >> 0] = g >> 16;
            b[(i + 3) >> 0] = g >> 24;
            k = (k + 4) | 0;
            b[k >> 0] = l;
            b[(k + 1) >> 0] = l >> 8;
            b[(k + 2) >> 0] = l >> 16;
            b[(k + 3) >> 0] = l >> 24;
            k = e;
            k = sq(f[k >> 2] | 0, f[(k + 4) >> 2] | 0, 8, 0) | 0;
            l = e;
            f[l >> 2] = k;
            f[(l + 4) >> 2] = I;
            break;
          }
        }
      while (0);
      b[(a + 36) >> 0] = 1;
      l = (a + 16) | 0;
      i = f[l >> 2] | 0;
      k = ((f[a >> 2] | 0) + i) | 0;
      g = (a + 8) | 0;
      l =
        Ip(f[g >> 2] | 0, f[(g + 4) >> 2] | 0, i | 0, f[(l + 4) >> 2] | 0) | 0;
      f[(a + 32) >> 2] = 0;
      f[(a + 24) >> 2] = k;
      f[(a + 28) >> 2] = k + l;
      l = 1;
      return l | 0;
    }
    function ii(a, b) {
      a = a | 0;
      b = b | 0;
      var c = 0,
        d = 0,
        e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0;
      k = u;
      u = (u + 16) | 0;
      j = k;
      l = (b + 8) | 0;
      i = f[l >> 2] | 0;
      l = f[(l + 4) >> 2] | 0;
      g = (b + 16) | 0;
      d = g;
      c = f[d >> 2] | 0;
      d = sq(c | 0, f[(d + 4) >> 2] | 0, 4, 0) | 0;
      e = I;
      if (((l | 0) < (e | 0)) | (((l | 0) == (e | 0)) & (i >>> 0 < d >>> 0))) {
        l = 0;
        u = k;
        return l | 0;
      }
      i = ((f[b >> 2] | 0) + c) | 0;
      i =
        h[i >> 0] |
        (h[(i + 1) >> 0] << 8) |
        (h[(i + 2) >> 0] << 16) |
        (h[(i + 3) >> 0] << 24);
      l = g;
      f[l >> 2] = d;
      f[(l + 4) >> 2] = e;
      if ((i | 0) < 0) {
        l = 0;
        u = k;
        return l | 0;
      }
      jg((a + 60) | 0, i, 0);
      is(j);
      if (lg(j, b) | 0) {
        if ((i | 0) > 0) {
          c = (a + 60) | 0;
          d = 0;
          e = 1;
          do {
            e = e ^ ((km(j) | 0) ^ 1);
            l = ((f[c >> 2] | 0) + (d >>> 5 << 2)) | 0;
            g = 1 << (d & 31);
            m = f[l >> 2] | 0;
            f[l >> 2] = e ? m | g : m & ~g;
            d = (d + 1) | 0;
          } while ((d | 0) < (i | 0));
        }
        c = Ij((a + 8) | 0, b) | 0;
      } else c = 0;
      Ss(j);
      m = c;
      u = k;
      return m | 0;
    }
    function ji(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0;
      j = u;
      u = (u + 16) | 0;
      h = (j + 8) | 0;
      g = (j + 4) | 0;
      e = j;
      if (!c) {
        i = 0;
        u = j;
        return i | 0;
      }
      f[a >> 2] = b;
      f[h >> 2] = 0;
      _k(h, b) | 0;
      a: do
        if (!(f[h >> 2] | 0)) i = 8;
        else {
          d = 0;
          while (1) {
            _k(g, f[a >> 2] | 0) | 0;
            b = Xo(44) | 0;
            f[b >> 2] = 0;
            f[(b + 4) >> 2] = 0;
            f[(b + 8) >> 2] = 0;
            f[(b + 12) >> 2] = 0;
            n[(b + 16) >> 2] = $(1.0);
            k = (b + 20) | 0;
            f[k >> 2] = 0;
            f[(k + 4) >> 2] = 0;
            f[(k + 8) >> 2] = 0;
            f[(k + 12) >> 2] = 0;
            n[(b + 36) >> 2] = $(1.0);
            f[(b + 40) >> 2] = f[g >> 2];
            if (!(Te(a, b) | 0)) break;
            f[e >> 2] = b;
            Dl(c, e) | 0;
            b = f[e >> 2] | 0;
            f[e >> 2] = 0;
            if (b | 0) {
              qk(b);
              Ns(b);
            }
            d = (d + 1) | 0;
            if (d >>> 0 >= (f[h >> 2] | 0) >>> 0) {
              i = 8;
              break a;
            }
          }
          qk(b);
          Ns(b);
          b = 0;
        }
      while (0);
      if ((i | 0) == 8) b = Te(a, c) | 0;
      k = b;
      u = j;
      return k | 0;
    }
    function ki(a, c) {
      a = a | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0;
      l = (a + 4) | 0;
      d = f[l >> 2] | 0;
      do
        if (d | 0) {
          m = b[(c + 11) >> 0] | 0;
          k = m << 24 >> 24 < 0;
          m = k ? f[(c + 4) >> 2] | 0 : m & 255;
          k = k ? f[c >> 2] | 0 : c;
          a = l;
          a: while (1) {
            c = d;
            while (1) {
              e = (c + 16) | 0;
              g = b[(e + 11) >> 0] | 0;
              h = g << 24 >> 24 < 0;
              g = h ? f[(c + 20) >> 2] | 0 : g & 255;
              d = m >>> 0 < g >>> 0 ? m : g;
              if (
                (d | 0) != 0
                  ? ((i = Wm(h ? f[e >> 2] | 0 : e, k, d) | 0), (i | 0) != 0)
                  : 0
              ) {
                if ((i | 0) >= 0) break;
              } else j = 6;
              if ((j | 0) == 6 ? ((j = 0), g >>> 0 >= m >>> 0) : 0) break;
              c = f[(c + 4) >> 2] | 0;
              if (!c) break a;
            }
            d = f[c >> 2] | 0;
            if (!d) {
              a = c;
              break;
            } else a = c;
          }
          if ((a | 0) != (l | 0)) {
            d = (a + 16) | 0;
            e = b[(d + 11) >> 0] | 0;
            g = e << 24 >> 24 < 0;
            e = g ? f[(a + 20) >> 2] | 0 : e & 255;
            c = e >>> 0 < m >>> 0 ? e : m;
            if (
              c | 0 ? ((n = Wm(k, g ? f[d >> 2] | 0 : d, c) | 0), n | 0) : 0
            ) {
              if ((n | 0) < 0) break;
              return a | 0;
            }
            if (m >>> 0 >= e >>> 0) {
              n = a;
              return n | 0;
            }
          }
        }
      while (0);
      n = l;
      return n | 0;
    }
    function li(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0;
      if ((d | 0) >= 8192) return Ba(a | 0, c | 0, d | 0) | 0;
      h = a | 0;
      g = (a + d) | 0;
      if ((a & 3) == (c & 3)) {
        while (a & 3) {
          if (!d) return h | 0;
          b[a >> 0] = b[c >> 0] | 0;
          a = (a + 1) | 0;
          c = (c + 1) | 0;
          d = (d - 1) | 0;
        }
        d = (g & -4) | 0;
        e = (d - 64) | 0;
        while ((a | 0) <= (e | 0)) {
          f[a >> 2] = f[c >> 2];
          f[(a + 4) >> 2] = f[(c + 4) >> 2];
          f[(a + 8) >> 2] = f[(c + 8) >> 2];
          f[(a + 12) >> 2] = f[(c + 12) >> 2];
          f[(a + 16) >> 2] = f[(c + 16) >> 2];
          f[(a + 20) >> 2] = f[(c + 20) >> 2];
          f[(a + 24) >> 2] = f[(c + 24) >> 2];
          f[(a + 28) >> 2] = f[(c + 28) >> 2];
          f[(a + 32) >> 2] = f[(c + 32) >> 2];
          f[(a + 36) >> 2] = f[(c + 36) >> 2];
          f[(a + 40) >> 2] = f[(c + 40) >> 2];
          f[(a + 44) >> 2] = f[(c + 44) >> 2];
          f[(a + 48) >> 2] = f[(c + 48) >> 2];
          f[(a + 52) >> 2] = f[(c + 52) >> 2];
          f[(a + 56) >> 2] = f[(c + 56) >> 2];
          f[(a + 60) >> 2] = f[(c + 60) >> 2];
          a = (a + 64) | 0;
          c = (c + 64) | 0;
        }
        while ((a | 0) < (d | 0)) {
          f[a >> 2] = f[c >> 2];
          a = (a + 4) | 0;
          c = (c + 4) | 0;
        }
      } else {
        d = (g - 4) | 0;
        while ((a | 0) < (d | 0)) {
          b[a >> 0] = b[c >> 0] | 0;
          b[(a + 1) >> 0] = b[(c + 1) >> 0] | 0;
          b[(a + 2) >> 0] = b[(c + 2) >> 0] | 0;
          b[(a + 3) >> 0] = b[(c + 3) >> 0] | 0;
          a = (a + 4) | 0;
          c = (c + 4) | 0;
        }
      }
      while ((a | 0) < (g | 0)) {
        b[a >> 0] = b[c >> 0] | 0;
        a = (a + 1) | 0;
        c = (c + 1) | 0;
      }
      return h | 0;
    }
    function mi(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0;
      b = f[(a + 196) >> 2] | 0;
      if (b | 0) {
        d = (a + 200) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      g = (a + 184) | 0;
      b = f[g >> 2] | 0;
      if (b | 0) {
        h = (a + 188) | 0;
        c = f[h >> 2] | 0;
        if ((c | 0) != (b | 0)) {
          do {
            d = (c + -12) | 0;
            f[h >> 2] = d;
            e = f[d >> 2] | 0;
            if (!e) c = d;
            else {
              d = (c + -8) | 0;
              c = f[d >> 2] | 0;
              if ((c | 0) != (e | 0))
                f[d >> 2] = c + (~(((c + -4 - e) | 0) >>> 2) << 2);
              Ns(e);
              c = f[h >> 2] | 0;
            }
          } while ((c | 0) != (b | 0));
          b = f[g >> 2] | 0;
        }
        Ns(b);
      }
      b = f[(a + 156) >> 2] | 0;
      if (b | 0) {
        d = (a + 160) | 0;
        c = f[d >> 2] | 0;
        if ((c | 0) != (b | 0))
          f[d >> 2] = c + (~(((c + -4 - b) | 0) >>> 2) << 2);
        Ns(b);
      }
      h = (a + 136) | 0;
      c = f[h >> 2] | 0;
      f[h >> 2] = 0;
      if (!c) {
        h = (a + 120) | 0;
        Ss(h);
        h = (a + 80) | 0;
        Ss(h);
        h = (a + 64) | 0;
        Ss(h);
        a = (a + 24) | 0;
        Ss(a);
        return;
      }
      d = (c + -4) | 0;
      b = f[d >> 2] | 0;
      if (b | 0) {
        b = (c + (b << 4)) | 0;
        do {
          b = (b + -16) | 0;
          Ss(b);
        } while ((b | 0) != (c | 0));
      }
      Ls(d);
      h = (a + 120) | 0;
      Ss(h);
      h = (a + 80) | 0;
      Ss(h);
      h = (a + 64) | 0;
      Ss(h);
      a = (a + 24) | 0;
      Ss(a);
      return;
    }
    function Jc(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        h = 0,
        i = La,
        j = 0,
        k = La,
        l = La,
        m = La,
        o = 0,
        p = 0,
        q = La,
        r = La,
        t = 0,
        v = 0,
        w = La,
        x = La,
        y = La,
        z = La,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = La;
      D = u;
      u = (u + 48) | 0;
      C = (D + 24) | 0;
      A = (D + 12) | 0;
      B = D;
      h = (a + 32) | 0;
      g = f[b >> 2] | 0;
      b = (g + 1) | 0;
      do
        if ((g | 0) >= 0) {
          b = (((b | 0) % 3) | 0 | 0) == 0 ? (g + -2) | 0 : b;
          if (!(((g >>> 0) % 3) | 0)) {
            g = (g + 2) | 0;
            break;
          } else {
            g = (g + -1) | 0;
            break;
          }
        } else b = g;
      while (0);
      v = f[((f[h >> 2] | 0) + 28) >> 2] | 0;
      t = f[(v + (b << 2)) >> 2] | 0;
      v = f[(v + (g << 2)) >> 2] | 0;
      g = (a + 36) | 0;
      h = f[g >> 2] | 0;
      b = f[(h + 4) >> 2] | 0;
      p = f[h >> 2] | 0;
      if ((b - p) >> 2 >>> 0 > t >>> 0) {
        j = b;
        o = h;
        b = p;
        g = p;
      } else {
        wr(h);
        g = f[g >> 2] | 0;
        j = f[(g + 4) >> 2] | 0;
        o = g;
        b = f[h >> 2] | 0;
        g = f[g >> 2] | 0;
      }
      b = f[(b + (t << 2)) >> 2] | 0;
      if ((j - g) >> 2 >>> 0 <= v >>> 0) {
        wr(o);
        g = f[o >> 2] | 0;
      }
      h = f[(g + (v << 2)) >> 2] | 0;
      g = (b | 0) < (d | 0);
      if (g & ((h | 0) < (d | 0))) {
        v = f[(a + 56) >> 2] | 0;
        t = X(v, b) | 0;
        y = $(f[(c + (t << 2)) >> 2] | 0);
        z = $(f[(c + ((t + 1) << 2)) >> 2] | 0);
        v = X(v, h) | 0;
        x = $(f[(c + (v << 2)) >> 2] | 0);
        w = $(f[(c + ((v + 1) << 2)) >> 2] | 0);
        if (!((x != y) | (w != z))) {
          a = f[(a + 52) >> 2] | 0;
          f[a >> 2] = ~~x;
          f[(a + 4) >> 2] = ~~w;
          u = D;
          return;
        }
        wi(C, a, d);
        wi(A, a, b);
        wi(B, a, h);
        r = $(n[B >> 2]);
        m = $(n[A >> 2]);
        r = $(r - m);
        q = $(n[(B + 4) >> 2]);
        i = $(n[(A + 4) >> 2]);
        q = $(q - i);
        l = $(n[(B + 8) >> 2]);
        e = $(n[(A + 8) >> 2]);
        l = $(l - e);
        m = $($(n[C >> 2]) - m);
        i = $($(n[(C + 4) >> 2]) - i);
        e = $($(n[(C + 8) >> 2]) - e);
        k = $($($($(r * r) + $(0.0)) + $(q * q)) + $(l * l));
        if (k > $(0.0) ? 1 : (f[(a + 72) >> 2] | 0) < 258) {
          E = $($($($($(r * m) + $(0.0)) + $(q * i)) + $(l * e)) / k);
          r = $(m - $(r * E));
          q = $(i - $(q * E));
          e = $(e - $(l * E));
          i = E;
          e = $(L($($($(e * e) + $($(q * q) + $($(r * r) + $(0.0)))) / k)));
        } else {
          i = $(0.0);
          e = $(0.0);
        }
        x = $(x - y);
        E = $(w - z);
        y = $(y + $(x * i));
        x = $(x * e);
        z = $(z + $(E * i));
        E = $(E * e);
        c = (a + 64) | 0;
        B = ((f[c >> 2] | 0) + -1) | 0;
        C =
          (((1 << (B & 31)) &
            f[((f[(a + 60) >> 2] | 0) + (B >>> 5 << 2)) >> 2]) |
            0) ==
          0;
        f[c >> 2] = B;
        i = $(-x);
        i = $(z + (C ? i : x));
        e = $(-E);
        e = $(y + (C ? E : e));
        if ((((n[s >> 2] = e), f[s >> 2] | 0) & 2147483647) >>> 0 > 2139095040)
          b = -2147483648;
        else b = ~~+J(+(+e + 0.5));
        g = f[(a + 52) >> 2] | 0;
        f[g >> 2] = b;
        if ((((n[s >> 2] = i), f[s >> 2] | 0) & 2147483647) >>> 0 > 2139095040)
          b = -2147483648;
        else b = ~~+J(+(+i + 0.5));
        f[(g + 4) >> 2] = b;
        u = D;
        return;
      }
      do
        if (!g) {
          if ((d | 0) > 0) {
            b = (d + -1) | 0;
            break;
          }
          h = (a + 56) | 0;
          if ((f[h >> 2] | 0) <= 0) {
            u = D;
            return;
          }
          b = f[(a + 52) >> 2] | 0;
          g = 0;
          do {
            f[(b + (g << 2)) >> 2] = 0;
            g = (g + 1) | 0;
          } while ((g | 0) < (f[h >> 2] | 0));
          u = D;
          return;
        }
      while (0);
      j = (a + 56) | 0;
      C = f[j >> 2] | 0;
      h = X(C, b) | 0;
      if ((C | 0) <= 0) {
        u = D;
        return;
      }
      b = f[(a + 52) >> 2] | 0;
      g = 0;
      do {
        f[(b + (g << 2)) >> 2] = f[(c + ((g + h) << 2)) >> 2];
        g = (g + 1) | 0;
      } while ((g | 0) < (f[j >> 2] | 0));
      u = D;
      return;
    }
    function Kc(a, b, c, d) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        h = 0,
        i = La,
        j = 0,
        k = La,
        l = La,
        m = La,
        o = 0,
        p = 0,
        q = La,
        r = La,
        t = 0,
        v = 0,
        w = La,
        x = La,
        y = La,
        z = La,
        A = 0,
        B = 0,
        C = 0,
        D = 0,
        E = La;
      D = u;
      u = (u + 48) | 0;
      C = (D + 24) | 0;
      A = (D + 12) | 0;
      B = D;
      h = (a + 48) | 0;
      g = f[b >> 2] | 0;
      b = (g + 1) | 0;
      do
        if ((g | 0) >= 0) {
          b = (((b | 0) % 3) | 0 | 0) == 0 ? (g + -2) | 0 : b;
          if (!(((g >>> 0) % 3) | 0)) {
            g = (g + 2) | 0;
            break;
          } else {
            g = (g + -1) | 0;
            break;
          }
        } else b = g;
      while (0);
      v = f[((f[h >> 2] | 0) + 28) >> 2] | 0;
      t = f[(v + (b << 2)) >> 2] | 0;
      v = f[(v + (g << 2)) >> 2] | 0;
      g = (a + 52) | 0;
      h = f[g >> 2] | 0;
      b = f[(h + 4) >> 2] | 0;
      p = f[h >> 2] | 0;
      if ((b - p) >> 2 >>> 0 > t >>> 0) {
        j = b;
        o = h;
        b = p;
        g = p;
      } else {
        wr(h);
        g = f[g >> 2] | 0;
        j = f[(g + 4) >> 2] | 0;
        o = g;
        b = f[h >> 2] | 0;
        g = f[g >> 2] | 0;
      }
      b = f[(b + (t << 2)) >> 2] | 0;
      if ((j - g) >> 2 >>> 0 <= v >>> 0) {
        wr(o);
        g = f[o >> 2] | 0;
      }
      h = f[(g + (v << 2)) >> 2] | 0;
      g = (b | 0) < (d | 0);
      if (g & ((h | 0) < (d | 0))) {
        v = f[(a + 72) >> 2] | 0;
        t = X(v, b) | 0;
        y = $(f[(c + (t << 2)) >> 2] | 0);
        z = $(f[(c + ((t + 1) << 2)) >> 2] | 0);
        v = X(v, h) | 0;
        x = $(f[(c + (v << 2)) >> 2] | 0);
        w = $(f[(c + ((v + 1) << 2)) >> 2] | 0);
        if (!((x != y) | (w != z))) {
          a = f[(a + 68) >> 2] | 0;
          f[a >> 2] = ~~x;
          f[(a + 4) >> 2] = ~~w;
          u = D;
          return;
        }
        Ai(C, a, d);
        Ai(A, a, b);
        Ai(B, a, h);
        r = $(n[B >> 2]);
        m = $(n[A >> 2]);
        r = $(r - m);
        q = $(n[(B + 4) >> 2]);
        i = $(n[(A + 4) >> 2]);
        q = $(q - i);
        l = $(n[(B + 8) >> 2]);
        e = $(n[(A + 8) >> 2]);
        l = $(l - e);
        m = $($(n[C >> 2]) - m);
        i = $($(n[(C + 4) >> 2]) - i);
        e = $($(n[(C + 8) >> 2]) - e);
        k = $($($($(r * r) + $(0.0)) + $(q * q)) + $(l * l));
        if (k > $(0.0) ? 1 : (f[(a + 88) >> 2] | 0) < 258) {
          E = $($($($($(r * m) + $(0.0)) + $(q * i)) + $(l * e)) / k);
          r = $(m - $(r * E));
          q = $(i - $(q * E));
          e = $(e - $(l * E));
          i = E;
          e = $(L($($($(e * e) + $($(q * q) + $($(r * r) + $(0.0)))) / k)));
        } else {
          i = $(0.0);
          e = $(0.0);
        }
        x = $(x - y);
        E = $(w - z);
        y = $(y + $(x * i));
        x = $(x * e);
        z = $(z + $(E * i));
        E = $(E * e);
        c = (a + 80) | 0;
        B = ((f[c >> 2] | 0) + -1) | 0;
        C =
          (((1 << (B & 31)) &
            f[((f[(a + 76) >> 2] | 0) + (B >>> 5 << 2)) >> 2]) |
            0) ==
          0;
        f[c >> 2] = B;
        i = $(-x);
        i = $(z + (C ? i : x));
        e = $(-E);
        e = $(y + (C ? E : e));
        if ((((n[s >> 2] = e), f[s >> 2] | 0) & 2147483647) >>> 0 > 2139095040)
          b = -2147483648;
        else b = ~~+J(+(+e + 0.5));
        g = f[(a + 68) >> 2] | 0;
        f[g >> 2] = b;
        if ((((n[s >> 2] = i), f[s >> 2] | 0) & 2147483647) >>> 0 > 2139095040)
          b = -2147483648;
        else b = ~~+J(+(+i + 0.5));
        f[(g + 4) >> 2] = b;
        u = D;
        return;
      }
      do
        if (!g) {
          if ((d | 0) > 0) {
            b = (d + -1) | 0;
            break;
          }
          h = (a + 72) | 0;
          if ((f[h >> 2] | 0) <= 0) {
            u = D;
            return;
          }
          b = f[(a + 68) >> 2] | 0;
          g = 0;
          do {
            f[(b + (g << 2)) >> 2] = 0;
            g = (g + 1) | 0;
          } while ((g | 0) < (f[h >> 2] | 0));
          u = D;
          return;
        }
      while (0);
      j = (a + 72) | 0;
      C = f[j >> 2] | 0;
      h = X(C, b) | 0;
      if ((C | 0) <= 0) {
        u = D;
        return;
      }
      b = f[(a + 68) >> 2] | 0;
      g = 0;
      do {
        f[(b + (g << 2)) >> 2] = f[(c + ((g + h) << 2)) >> 2];
        g = (g + 1) | 0;
      } while ((g | 0) < (f[j >> 2] | 0));
      u = D;
      return;
    }
    function Lc(a) {
      a = a | 0;
      var b = 0,
        c = 0,
        d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0;
      o = u;
      u = (u + 32) | 0;
      k = (o + 4) | 0;
      j = o;
      c = (a + 16) | 0;
      b = f[c >> 2] | 0;
      if (b >>> 0 > 340) {
        f[c >> 2] = b + -341;
        l = (a + 4) | 0;
        k = f[l >> 2] | 0;
        m = f[k >> 2] | 0;
        k = (k + 4) | 0;
        f[l >> 2] = k;
        n = (a + 8) | 0;
        b = f[n >> 2] | 0;
        j = (a + 12) | 0;
        i = f[j >> 2] | 0;
        d = i;
        g = b;
        do
          if ((b | 0) == (i | 0)) {
            c = f[a >> 2] | 0;
            e = c;
            if (k >>> 0 > c >>> 0) {
              b = k;
              e = (((((b - e) >> 2) + 1) | 0) / -2) | 0;
              d = (k + (e << 2)) | 0;
              b = (g - b) | 0;
              c = b >> 2;
              if (!c) b = k;
              else {
                _n(d | 0, k | 0, b | 0) | 0;
                b = f[l >> 2] | 0;
              }
              a = (d + (c << 2)) | 0;
              f[n >> 2] = a;
              f[l >> 2] = b + (e << 2);
              b = a;
              break;
            }
            d = (d - e) >> 1;
            d = (d | 0) == 0 ? 1 : d;
            if (d >>> 0 > 1073741823) {
              o = Ia(4) | 0;
              ps(o);
              sa(o | 0, 1488, 137);
            }
            g = Xo(d << 2) | 0;
            h = g;
            e = (g + (d >>> 2 << 2)) | 0;
            i = e;
            g = (g + (d << 2)) | 0;
            if ((k | 0) == (b | 0)) b = i;
            else {
              d = e;
              c = k;
              e = i;
              do {
                f[d >> 2] = f[c >> 2];
                d = (e + 4) | 0;
                e = d;
                c = (c + 4) | 0;
              } while ((c | 0) != (b | 0));
              c = f[a >> 2] | 0;
              b = e;
            }
            f[a >> 2] = h;
            f[l >> 2] = i;
            f[n >> 2] = b;
            f[j >> 2] = g;
            if (c) {
              Ns(c);
              b = f[n >> 2] | 0;
            }
          }
        while (0);
        f[b >> 2] = m;
        f[n >> 2] = (f[n >> 2] | 0) + 4;
        u = o;
        return;
      }
      n = (a + 8) | 0;
      b = f[n >> 2] | 0;
      m = (a + 4) | 0;
      e = (b - (f[m >> 2] | 0)) | 0;
      l = (a + 12) | 0;
      c = f[l >> 2] | 0;
      d = (c - (f[a >> 2] | 0)) | 0;
      if (e >>> 0 >= d >>> 0) {
        b = d >> 1;
        b = (b | 0) == 0 ? 1 : b;
        f[(k + 12) >> 2] = 0;
        f[(k + 16) >> 2] = a + 12;
        if (b >>> 0 > 1073741823) {
          o = Ia(4) | 0;
          ps(o);
          sa(o | 0, 1488, 137);
        }
        d = Xo(b << 2) | 0;
        f[k >> 2] = d;
        h = (d + (e >> 2 << 2)) | 0;
        i = (k + 8) | 0;
        f[i >> 2] = h;
        g = (k + 4) | 0;
        f[g >> 2] = h;
        h = (k + 12) | 0;
        f[h >> 2] = d + (b << 2);
        e = Xo(4092) | 0;
        f[j >> 2] = e;
        fi(k, j);
        e = f[n >> 2] | 0;
        while (1) {
          b = f[m >> 2] | 0;
          if ((e | 0) == (b | 0)) break;
          j = (e + -4) | 0;
          ai(k, j);
          e = j;
        }
        c = b;
        d = f[a >> 2] | 0;
        f[a >> 2] = f[k >> 2];
        f[k >> 2] = d;
        f[m >> 2] = f[g >> 2];
        f[g >> 2] = c;
        b = f[n >> 2] | 0;
        f[n >> 2] = f[i >> 2];
        f[i >> 2] = b;
        a = f[l >> 2] | 0;
        f[l >> 2] = f[h >> 2];
        f[h >> 2] = a;
        if ((b | 0) != (e | 0))
          f[i >> 2] = b + (~(((b + -4 - c) | 0) >>> 2) << 2);
        if (d | 0) Ns(d);
        u = o;
        return;
      }
      if ((c | 0) != (b | 0)) {
        n = Xo(4092) | 0;
        f[k >> 2] = n;
        fi(a, k);
        u = o;
        return;
      }
      j = Xo(4092) | 0;
      f[k >> 2] = j;
      ai(a, k);
      j = f[m >> 2] | 0;
      k = f[j >> 2] | 0;
      j = (j + 4) | 0;
      f[m >> 2] = j;
      b = f[n >> 2] | 0;
      i = f[l >> 2] | 0;
      c = i;
      g = b;
      do
        if ((b | 0) == (i | 0)) {
          e = f[a >> 2] | 0;
          d = e;
          if (j >>> 0 > e >>> 0) {
            b = j;
            e = (((((b - d) >> 2) + 1) | 0) / -2) | 0;
            d = (j + (e << 2)) | 0;
            b = (g - b) | 0;
            c = b >> 2;
            if (!c) b = j;
            else {
              _n(d | 0, j | 0, b | 0) | 0;
              b = f[m >> 2] | 0;
            }
            a = (d + (c << 2)) | 0;
            f[n >> 2] = a;
            f[m >> 2] = b + (e << 2);
            b = a;
            break;
          }
          c = (c - d) >> 1;
          c = (c | 0) == 0 ? 1 : c;
          if (c >>> 0 > 1073741823) {
            o = Ia(4) | 0;
            ps(o);
            sa(o | 0, 1488, 137);
          }
          g = Xo(c << 2) | 0;
          h = g;
          d = (g + (c >>> 2 << 2)) | 0;
          i = d;
          g = (g + (c << 2)) | 0;
          if ((j | 0) == (b | 0)) {
            c = e;
            b = i;
          } else {
            c = j;
            e = i;
            do {
              f[d >> 2] = f[c >> 2];
              d = (e + 4) | 0;
              e = d;
              c = (c + 4) | 0;
            } while ((c | 0) != (b | 0));
            c = f[a >> 2] | 0;
            b = e;
          }
          f[a >> 2] = h;
          f[m >> 2] = i;
          f[n >> 2] = b;
          f[l >> 2] = g;
          if (c) {
            Ns(c);
            b = f[n >> 2] | 0;
          }
        }
      while (0);
      f[b >> 2] = k;
      f[n >> 2] = (f[n >> 2] | 0) + 4;
      u = o;
      return;
    }
    function Mc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = La,
        l = La,
        m = La,
        o = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          i = ~~$(n[s >> 2]);
          f[d >> 2] = i;
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          i = j;
          j = (j + 4) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          i = ~~(
            (f[s >> 2] =
              h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)),
            $(n[s >> 2])
          );
          f[d >> 2] = i;
          j = ~~((f[s >> 2] = j), $(n[s >> 2]));
          f[(d + 4) >> 2] = j;
          j = (d + 8) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          m = $(n[s >> 2]);
          i = (j + 4) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          l = $(n[s >> 2]);
          j = (j + 8) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          k = $(n[s >> 2]);
          f[d >> 2] = ~~m;
          f[(d + 4) >> 2] = ~~l;
          f[(d + 8) >> 2] = ~~k;
          f[(d + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          o = $(n[s >> 2]);
          i = (j + 4) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          k = $(n[s >> 2]);
          i = (j + 8) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          l = $(n[s >> 2]);
          j = (j + 12) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          m = $(n[s >> 2]);
          f[d >> 2] = ~~o;
          f[(d + 4) >> 2] = ~~k;
          f[(d + 8) >> 2] = ~~l;
          f[(d + 12) >> 2] = ~~m;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Nc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = La,
        j = 0,
        k = 0,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 4, 0) | 0;
          l = I;
          j = f[a >> 2] | 0;
          g = f[j >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? k >>> 0 > (((f[(j + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          e = $(
            (h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) >>>
              0
          );
          i = $(e * $(2.32830644e-10));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? e : i;
          l = (d + 4) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          f[(l + 8) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 8, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          c = (g + c) | 0;
          l = c;
          c = (c + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          e = $(
            (h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c >>> 0);
          } else {
            e = $(e * $(2.32830644e-10));
            n[d >> 2] = e;
            e = $($(c >>> 0) * $(2.32830644e-10));
          }
          n[(d + 4) >> 2] = e;
          l = (d + 8) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 3: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 12, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (l + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            (h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c >>> 0);
            e = $(g >>> 0);
          } else {
            i = $(e * $(2.32830644e-10));
            n[d >> 2] = i;
            i = $($(c >>> 0) * $(2.32830644e-10));
            e = $($(g >>> 0) * $(2.32830644e-10));
          }
          n[(d + 4) >> 2] = i;
          n[(d + 8) >> 2] = e;
          n[(d + 12) >> 2] = $(0.0);
          l = 1;
          return l | 0;
        }
        case 4: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 16, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (l + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          j = (l + 12) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          e = $(
            (h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c >>> 0);
            n[(d + 4) >> 2] = i;
            i = $(g >>> 0);
            n[(d + 8) >> 2] = i;
            i = $(j >>> 0);
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          } else {
            i = $(e * $(2.32830644e-10));
            n[d >> 2] = i;
            i = $($(c >>> 0) * $(2.32830644e-10));
            n[(d + 4) >> 2] = i;
            i = $($(g >>> 0) * $(2.32830644e-10));
            n[(d + 8) >> 2] = i;
            i = $($(j >>> 0) * $(2.32830644e-10));
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          }
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function Oc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = La,
        j = 0,
        k = 0,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 4, 0) | 0;
          l = I;
          j = f[a >> 2] | 0;
          g = f[j >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? k >>> 0 > (((f[(j + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          e = $(
            h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24) |
              0
          );
          i = $(e * $(4.65661287e-10));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? e : i;
          l = (d + 4) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          f[(l + 8) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 8, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          c = (g + c) | 0;
          l = c;
          c = (c + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          e = $(
            h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c | 0);
          } else {
            e = $(e * $(4.65661287e-10));
            n[d >> 2] = e;
            e = $($(c | 0) * $(4.65661287e-10));
          }
          n[(d + 4) >> 2] = e;
          l = (d + 8) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 3: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 12, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (l + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c | 0);
            e = $(g | 0);
          } else {
            i = $(e * $(4.65661287e-10));
            n[d >> 2] = i;
            i = $($(c | 0) * $(4.65661287e-10));
            e = $($(g | 0) * $(4.65661287e-10));
          }
          n[(d + 4) >> 2] = i;
          n[(d + 8) >> 2] = e;
          n[(d + 12) >> 2] = $(0.0);
          l = 1;
          return l | 0;
        }
        case 4: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 16, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (l + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          j = (l + 12) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          e = $(
            h[l >> 0] |
              (h[(l + 1) >> 0] << 8) |
              (h[(l + 2) >> 0] << 16) |
              (h[(l + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c | 0);
            n[(d + 4) >> 2] = i;
            i = $(g | 0);
            n[(d + 8) >> 2] = i;
            i = $(j | 0);
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          } else {
            i = $(e * $(4.65661287e-10));
            n[d >> 2] = i;
            i = $($(c | 0) * $(4.65661287e-10));
            n[(d + 4) >> 2] = i;
            i = $($(g | 0) * $(4.65661287e-10));
            n[(d + 8) >> 2] = i;
            i = $($(j | 0) * $(4.65661287e-10));
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          }
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function Pc(a, b, c) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      var d = 0,
        e = 0,
        g = 0,
        h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0;
      v = u;
      u = (u + 16) | 0;
      r = (v + 8) | 0;
      q = (v + 4) | 0;
      o = v;
      p = (a + 64) | 0;
      c = f[p >> 2] | 0;
      if ((((f[(c + 28) >> 2] | 0) - (f[(c + 24) >> 2] | 0)) | 0) <= 0) {
        u = v;
        return;
      }
      s = (a + 52) | 0;
      k = (a + 56) | 0;
      m = (a + 60) | 0;
      i = (a + 12) | 0;
      j = (a + 28) | 0;
      t = (a + 40) | 0;
      l = (a + 44) | 0;
      n = (a + 48) | 0;
      b = 0;
      h = 0;
      do {
        d = f[((f[(c + 24) >> 2] | 0) + (h << 2)) >> 2] | 0;
        if ((d | 0) >= 0) {
          e = (b + 1) | 0;
          f[r >> 2] = b;
          c = f[k >> 2] | 0;
          if ((c | 0) == (f[m >> 2] | 0)) hk(s, r);
          else {
            f[c >> 2] = b;
            f[k >> 2] = c + 4;
          }
          f[q >> 2] = d;
          f[o >> 2] = 0;
          a: do
            if (!(f[((f[i >> 2] | 0) + (h >>> 5 << 2)) >> 2] & (1 << (h & 31))))
              c = d;
            else {
              c = (d + 1) | 0;
              c = (((c | 0) % 3) | 0 | 0) == 0 ? (d + -2) | 0 : c;
              g = f[a >> 2] | 0;
              if (!((1 << (c & 31)) & f[(g + (c >>> 5 << 2)) >> 2])) {
                if ((c | 0) >= 0) {
                  c =
                    f[((f[((f[p >> 2] | 0) + 12) >> 2] | 0) + (c << 2)) >> 2] |
                    0;
                  b = (c + 1) | 0;
                  if ((c | 0) >= 0) {
                    c = (((b | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : b;
                    f[o >> 2] = c;
                    if ((c | 0) <= -1) {
                      c = d;
                      break;
                    }
                    while (1) {
                      f[q >> 2] = c;
                      b = (c + 1) | 0;
                      b = (((b | 0) % 3) | 0 | 0) == 0 ? (c + -2) | 0 : b;
                      if (
                        ((1 << (b & 31)) & f[(g + (b >>> 5 << 2)) >> 2]) |
                        0
                      ) {
                        b = -1073741824;
                        break;
                      }
                      if ((b | 0) < 0) break;
                      b =
                        f[
                          ((f[((f[p >> 2] | 0) + 12) >> 2] | 0) + (b << 2)) >> 2
                        ] | 0;
                      d = (b + 1) | 0;
                      if ((b | 0) < 0) break;
                      b = (((d | 0) % 3) | 0 | 0) == 0 ? (b + -2) | 0 : d;
                      f[o >> 2] = b;
                      if ((b | 0) > -1) c = b;
                      else break a;
                    }
                    f[o >> 2] = b;
                    break;
                  }
                }
              } else c = -1073741824;
              f[o >> 2] = c;
              c = d;
            }
          while (0);
          f[((f[j >> 2] | 0) + (c << 2)) >> 2] = f[r >> 2];
          c = f[l >> 2] | 0;
          if ((c | 0) == (f[n >> 2] | 0)) hk(t, q);
          else {
            f[c >> 2] = f[q >> 2];
            f[l >> 2] = c + 4;
          }
          c = f[p >> 2] | 0;
          b = f[q >> 2] | 0;
          b: do
            if ((b | 0) >= 0) {
              d = (((((b >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + b) | 0;
              if ((d | 0) >= 0) {
                d = f[((f[(c + 12) >> 2] | 0) + (d << 2)) >> 2] | 0;
                if ((d | 0) >= 0) {
                  d = (d + ((((d >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1)) | 0;
                  f[o >> 2] = d;
                  if (((d | 0) > -1) & ((d | 0) != (b | 0))) {
                    b = d;
                    while (1) {
                      g = (b + 1) | 0;
                      g = (((g | 0) % 3) | 0 | 0) == 0 ? (b + -2) | 0 : g;
                      do
                        if (
                          f[((f[a >> 2] | 0) + (g >>> 5 << 2)) >> 2] &
                          (1 << (g & 31))
                        ) {
                          b = (e + 1) | 0;
                          f[r >> 2] = e;
                          c = f[k >> 2] | 0;
                          if ((c | 0) == (f[m >> 2] | 0)) hk(s, r);
                          else {
                            f[c >> 2] = e;
                            f[k >> 2] = c + 4;
                          }
                          c = f[l >> 2] | 0;
                          if ((c | 0) == (f[n >> 2] | 0)) {
                            hk(t, o);
                            e = b;
                            break;
                          } else {
                            f[c >> 2] = f[o >> 2];
                            f[l >> 2] = c + 4;
                            e = b;
                            break;
                          }
                        }
                      while (0);
                      f[((f[j >> 2] | 0) + (f[o >> 2] << 2)) >> 2] = f[r >> 2];
                      c = f[p >> 2] | 0;
                      b = f[o >> 2] | 0;
                      if ((b | 0) < 0) break;
                      b = (((((b >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1) + b) | 0;
                      if ((b | 0) < 0) break;
                      b = f[((f[(c + 12) >> 2] | 0) + (b << 2)) >> 2] | 0;
                      if ((b | 0) < 0) break;
                      b = (b + ((((b >>> 0) % 3) | 0 | 0) == 0 ? 2 : -1)) | 0;
                      f[o >> 2] = b;
                      if (!((b | 0) > -1 ? (b | 0) != (f[q >> 2] | 0) : 0)) {
                        b = e;
                        break b;
                      }
                    }
                    f[o >> 2] = b;
                    b = e;
                  } else b = e;
                } else {
                  b = d;
                  w = 26;
                }
              } else {
                b = d;
                w = 26;
              }
            } else w = 26;
          while (0);
          if ((w | 0) == 26) {
            w = 0;
            f[o >> 2] = b;
            b = e;
          }
        }
        h = (h + 1) | 0;
      } while (
        (h | 0) < ((((f[(c + 28) >> 2] | 0) - (f[(c + 24) >> 2] | 0)) >> 2) | 0)
      );
      u = v;
      return;
    }
    function Qc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        h = 0,
        i = 0.0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          h = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                h | 0,
                (((h | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          h = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((h | 0) > 0) |
            ((h | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            h = 0;
            return h | 0;
          }
          g = (c + e) | 0;
          b[s >> 0] = b[g >> 0];
          b[(s + 1) >> 0] = b[(g + 1) >> 0];
          b[(s + 2) >> 0] = b[(g + 2) >> 0];
          b[(s + 3) >> 0] = b[(g + 3) >> 0];
          b[(s + 4) >> 0] = b[(g + 4) >> 0];
          b[(s + 5) >> 0] = b[(g + 5) >> 0];
          b[(s + 6) >> 0] = b[(g + 6) >> 0];
          b[(s + 7) >> 0] = b[(g + 7) >> 0];
          i = +p[s >> 3];
          g = +K(i) >= 1.0
            ? i > 0.0
              ? ~~+Y(+J(i / 4294967296.0), 4294967295.0) >>> 0
              : ~~+W((i - +(~~i >>> 0)) / 4294967296.0) >>> 0
            : 0;
          h = d;
          f[h >> 2] = ~~i >>> 0;
          f[(h + 4) >> 2] = g;
          h = 1;
          return h | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          h = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[h >> 2] | 0,
                f[(h + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 16, 0) | 0;
          j = I;
          h = f[a >> 2] | 0;
          c = f[h >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(h + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          h = (c + e) | 0;
          b[s >> 0] = b[h >> 0];
          b[(s + 1) >> 0] = b[(h + 1) >> 0];
          b[(s + 2) >> 0] = b[(h + 2) >> 0];
          b[(s + 3) >> 0] = b[(h + 3) >> 0];
          b[(s + 4) >> 0] = b[(h + 4) >> 0];
          b[(s + 5) >> 0] = b[(h + 5) >> 0];
          b[(s + 6) >> 0] = b[(h + 6) >> 0];
          b[(s + 7) >> 0] = b[(h + 7) >> 0];
          i = +p[s >> 3];
          h = +K(i) >= 1.0
            ? i > 0.0
              ? ~~+Y(+J(i / 4294967296.0), 4294967295.0) >>> 0
              : ~~+W((i - +(~~i >>> 0)) / 4294967296.0) >>> 0
            : 0;
          j = d;
          f[j >> 2] = ~~i >>> 0;
          f[(j + 4) >> 2] = h;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          h = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              h | 0,
              e | 0
            ) | 0;
          h = sq(e | 0, I | 0, 24, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? h >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          h = (c + e) | 0;
          b[s >> 0] = b[h >> 0];
          b[(s + 1) >> 0] = b[(h + 1) >> 0];
          b[(s + 2) >> 0] = b[(h + 2) >> 0];
          b[(s + 3) >> 0] = b[(h + 3) >> 0];
          b[(s + 4) >> 0] = b[(h + 4) >> 0];
          b[(s + 5) >> 0] = b[(h + 5) >> 0];
          b[(s + 6) >> 0] = b[(h + 6) >> 0];
          b[(s + 7) >> 0] = b[(h + 7) >> 0];
          i = +p[s >> 3];
          h = +K(i) >= 1.0
            ? i > 0.0
              ? ~~+Y(+J(i / 4294967296.0), 4294967295.0) >>> 0
              : ~~+W((i - +(~~i >>> 0)) / 4294967296.0) >>> 0
            : 0;
          j = d;
          f[j >> 2] = ~~i >>> 0;
          f[(j + 4) >> 2] = h;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          h = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              h | 0,
              e | 0
            ) | 0;
          h = sq(e | 0, I | 0, 32, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? h >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          h = (c + e) | 0;
          b[s >> 0] = b[h >> 0];
          b[(s + 1) >> 0] = b[(h + 1) >> 0];
          b[(s + 2) >> 0] = b[(h + 2) >> 0];
          b[(s + 3) >> 0] = b[(h + 3) >> 0];
          b[(s + 4) >> 0] = b[(h + 4) >> 0];
          b[(s + 5) >> 0] = b[(h + 5) >> 0];
          b[(s + 6) >> 0] = b[(h + 6) >> 0];
          b[(s + 7) >> 0] = b[(h + 7) >> 0];
          i = +p[s >> 3];
          h = +K(i) >= 1.0
            ? i > 0.0
              ? ~~+Y(+J(i / 4294967296.0), 4294967295.0) >>> 0
              : ~~+W((i - +(~~i >>> 0)) / 4294967296.0) >>> 0
            : 0;
          j = d;
          f[j >> 2] = ~~i >>> 0;
          f[(j + 4) >> 2] = h;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Rc(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0;
      C = u;
      u = (u + 32) | 0;
      w = (C + 28) | 0;
      x = (C + 16) | 0;
      y = (C + 8) | 0;
      v = C;
      z = (a + 8) | 0;
      d = f[(a + 12) >> 2] | 0;
      if ((d | 0) <= 1) Ga(10396, 10407, 60, 10522);
      if ((d | 0) >= 31) Ga(10542, 10407, 61, 10522);
      f[(a + 76) >> 2] = d;
      t = 1 << d;
      f[(a + 80) >> 2] = t + -1;
      t = (t + -2) | 0;
      s = (a + 84) | 0;
      f[s >> 2] = t;
      r = (a + 88) | 0;
      f[r >> 2] = ((t | 0) / 2) | 0;
      t = (a + 44) | 0;
      f[(a + 52) >> 2] = g;
      if (!(Sa[f[((f[a >> 2] | 0) + 16) >> 2] & 255](a) | 0))
        Ga(11762, 12575, 99, 12732);
      if ((e | 0) != 2) Ga(12754, 12575, 102, 12732);
      p = (a + 40) | 0;
      d = f[p >> 2] | 0;
      o = ((f[(d + 4) >> 2] | 0) - (f[d >> 2] | 0)) | 0;
      q = o >> 2;
      f[x >> 2] = 0;
      f[(x + 4) >> 2] = 0;
      f[(x + 8) >> 2] = 0;
      if ((o | 0) <= 0) {
        u = C;
        return 1;
      }
      n = (x + 4) | 0;
      o = (x + 8) | 0;
      m = (a + 92) | 0;
      l = (y + 4) | 0;
      g = d;
      k = 0;
      while (1) {
        d = f[g >> 2] | 0;
        if (((f[(g + 4) >> 2] | 0) - d) >> 2 >>> 0 <= k >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[v >> 2] = f[(d + (k << 2)) >> 2];
        f[w >> 2] = f[v >> 2];
        Vb(t, w, x);
        d = f[x >> 2] | 0;
        a = (d | 0) > -1 ? d : (0 - d) | 0;
        g = f[n >> 2] | 0;
        e = (g | 0) > -1 ? g : (0 - g) | 0;
        a =
          sq(
            e | 0,
            (((e | 0) < 0) << 31 >> 31) | 0,
            a | 0,
            (((a | 0) < 0) << 31 >> 31) | 0
          ) | 0;
        e = f[o >> 2] | 0;
        h = (e | 0) > -1;
        e = h ? e : (0 - e) | 0;
        e = sq(a | 0, I | 0, e | 0, (((e | 0) < 0) << 31 >> 31) | 0) | 0;
        a = I;
        i = f[r >> 2] | 0;
        if (((e | 0) == 0) & ((a | 0) == 0)) {
          g = x;
          d = i;
        } else {
          D = ((i | 0) < 0) << 31 >> 31;
          j = Wo(i | 0, D | 0, d | 0, (((d | 0) < 0) << 31 >> 31) | 0) | 0;
          j = Tl(j | 0, I | 0, e | 0, a | 0) | 0;
          f[x >> 2] = j;
          d = Wo(i | 0, D | 0, g | 0, (((g | 0) < 0) << 31 >> 31) | 0) | 0;
          d = Tl(d | 0, I | 0, e | 0, a | 0) | 0;
          f[n >> 2] = d;
          d =
            (i -
              ((j | 0) > -1 ? j : (0 - j) | 0) -
              ((d | 0) > -1 ? d : (0 - d) | 0)) |
            0;
          g = o;
          d = h ? d : (0 - d) | 0;
        }
        f[g >> 2] = d;
        j = f[x >> 2] | 0;
        h = f[n >> 2] | 0;
        D = f[o >> 2] | 0;
        if (
          ((((h | 0) > -1 ? h : (0 - h) | 0) +
            ((j | 0) > -1 ? j : (0 - j) | 0) +
            ((D | 0) > -1 ? D : (0 - D) | 0)) |
            0) !=
          (i | 0)
        ) {
          d = 18;
          break;
        }
        D = km(m) | 0;
        d = f[x >> 2] | 0;
        if (D) {
          d = (0 - d) | 0;
          g = (0 - (f[n >> 2] | 0)) | 0;
          i = (0 - (f[o >> 2] | 0)) | 0;
          f[x >> 2] = d;
          f[n >> 2] = g;
          f[o >> 2] = i;
        } else {
          g = f[n >> 2] | 0;
          i = f[o >> 2] | 0;
        }
        a = (d | 0) > -1;
        h = (g | 0) > -1 ? g : (0 - g) | 0;
        e = (i | 0) > -1 ? i : (0 - i) | 0;
        j = (h + (a ? d : (0 - d) | 0) + e) | 0;
        if ((j | 0) != (f[r >> 2] | 0)) {
          d = 23;
          break;
        }
        if (!a) {
          if ((g | 0) < 0) d = e;
          else d = ((f[s >> 2] | 0) - e) | 0;
          if ((i | 0) < 0) {
            g = d;
            d = h;
          } else {
            g = d;
            d = ((f[s >> 2] | 0) - h) | 0;
          }
        } else {
          g = (j + g) | 0;
          d = (j + i) | 0;
        }
        e = (g | 0) == 0;
        a = (d | 0) == 0;
        h = f[s >> 2] | 0;
        do
          if (
            (d | g | 0) != 0
              ? (
                  (A = (h | 0) == (d | 0)),
                  (B = (h | 0) == (g | 0)),
                  !((e & A) | (a & B))
                )
              : 0
          ) {
            if (e & ((j | 0) < (d | 0))) {
              g = 0;
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (d | 0)) & B) {
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (g | 0)) & A) {
              g = ((j << 1) - g) | 0;
              break;
            } else {
              g = ((j | 0) < (g | 0)) & a ? ((j << 1) - g) | 0 : g;
              break;
            }
          } else {
            g = h;
            d = h;
          }
        while (0);
        f[y >> 2] = g;
        f[l >> 2] = d;
        d = k << 1;
        Hj(z, y, (b + (d << 2)) | 0, (c + (d << 2)) | 0);
        d = (k + 1) | 0;
        if ((d | 0) >= (q | 0)) {
          d = 11;
          break;
        }
        g = f[p >> 2] | 0;
        k = d;
      }
      if ((d | 0) == 11) {
        u = C;
        return 1;
      } else if ((d | 0) == 18) Ga(12778, 12575, 116, 12732);
      else if ((d | 0) == 23) Ga(12845, 10407, 99, 12933);
      return 0;
    }
    function Sc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          k = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          i = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                k | 0,
                (((k | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 4, 0) | 0;
          k = I;
          i = f[a >> 2] | 0;
          g = f[i >> 2] | 0;
          if (
            ((k | 0) > 0) |
            ((k | 0) == 0
              ? j >>> 0 > (((f[(i + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          l = $(
            (h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24)) >>>
              0
          );
          e = $(l * $(2.32830644e-10));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? l : e;
          k = (d + 4) | 0;
          f[k >> 2] = 0;
          f[(k + 4) >> 2] = 0;
          k = 1;
          return k | 0;
        }
        case 2: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 8, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          c = (g + c) | 0;
          k = c;
          c = (c + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          e = $(
            (h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c >>> 0);
          } else {
            e = $(e * $(2.32830644e-10));
            n[d >> 2] = e;
            e = $($(c >>> 0) * $(2.32830644e-10));
          }
          n[(d + 4) >> 2] = e;
          n[(d + 8) >> 2] = $(0.0);
          k = 1;
          return k | 0;
        }
        case 3: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 12, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          c = (k + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (k + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            (h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            l = $(c >>> 0);
            n[(d + 4) >> 2] = l;
            l = $(g >>> 0);
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          } else {
            l = $(e * $(2.32830644e-10));
            n[d >> 2] = l;
            l = $($(c >>> 0) * $(2.32830644e-10));
            n[(d + 4) >> 2] = l;
            l = $($(g >>> 0) * $(2.32830644e-10));
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          }
        }
        case 4: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 16, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          c = (k + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (k + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            (h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24)) >>>
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            l = $(c >>> 0);
            n[(d + 4) >> 2] = l;
            l = $(g >>> 0);
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          } else {
            l = $(e * $(2.32830644e-10));
            n[d >> 2] = l;
            l = $($(c >>> 0) * $(2.32830644e-10));
            n[(d + 4) >> 2] = l;
            l = $($(g >>> 0) * $(2.32830644e-10));
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          }
        }
        default: {
          k = 0;
          return k | 0;
        }
      }
      return 0;
    }
    function Tc(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0;
      C = u;
      u = (u + 32) | 0;
      w = (C + 28) | 0;
      x = (C + 16) | 0;
      y = (C + 8) | 0;
      v = C;
      z = (a + 8) | 0;
      d = f[(a + 12) >> 2] | 0;
      if ((d | 0) <= 1) Ga(10396, 10407, 60, 10522);
      if ((d | 0) >= 31) Ga(10542, 10407, 61, 10522);
      f[(a + 76) >> 2] = d;
      t = 1 << d;
      f[(a + 80) >> 2] = t + -1;
      t = (t + -2) | 0;
      s = (a + 84) | 0;
      f[s >> 2] = t;
      r = (a + 88) | 0;
      f[r >> 2] = ((t | 0) / 2) | 0;
      t = (a + 44) | 0;
      f[(a + 52) >> 2] = g;
      if (!(Sa[f[((f[a >> 2] | 0) + 16) >> 2] & 255](a) | 0))
        Ga(11762, 12575, 99, 12732);
      if ((e | 0) != 2) Ga(12754, 12575, 102, 12732);
      p = (a + 40) | 0;
      d = f[p >> 2] | 0;
      o = ((f[(d + 4) >> 2] | 0) - (f[d >> 2] | 0)) | 0;
      q = o >> 2;
      f[x >> 2] = 0;
      f[(x + 4) >> 2] = 0;
      f[(x + 8) >> 2] = 0;
      if ((o | 0) <= 0) {
        u = C;
        return 1;
      }
      n = (x + 4) | 0;
      o = (x + 8) | 0;
      m = (a + 92) | 0;
      l = (y + 4) | 0;
      g = d;
      k = 0;
      while (1) {
        d = f[g >> 2] | 0;
        if (((f[(g + 4) >> 2] | 0) - d) >> 2 >>> 0 <= k >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[v >> 2] = f[(d + (k << 2)) >> 2];
        f[w >> 2] = f[v >> 2];
        Tb(t, w, x);
        d = f[x >> 2] | 0;
        a = (d | 0) > -1 ? d : (0 - d) | 0;
        g = f[n >> 2] | 0;
        e = (g | 0) > -1 ? g : (0 - g) | 0;
        a =
          sq(
            e | 0,
            (((e | 0) < 0) << 31 >> 31) | 0,
            a | 0,
            (((a | 0) < 0) << 31 >> 31) | 0
          ) | 0;
        e = f[o >> 2] | 0;
        h = (e | 0) > -1;
        e = h ? e : (0 - e) | 0;
        e = sq(a | 0, I | 0, e | 0, (((e | 0) < 0) << 31 >> 31) | 0) | 0;
        a = I;
        i = f[r >> 2] | 0;
        if (((e | 0) == 0) & ((a | 0) == 0)) {
          g = x;
          d = i;
        } else {
          D = ((i | 0) < 0) << 31 >> 31;
          j = Wo(i | 0, D | 0, d | 0, (((d | 0) < 0) << 31 >> 31) | 0) | 0;
          j = Tl(j | 0, I | 0, e | 0, a | 0) | 0;
          f[x >> 2] = j;
          d = Wo(i | 0, D | 0, g | 0, (((g | 0) < 0) << 31 >> 31) | 0) | 0;
          d = Tl(d | 0, I | 0, e | 0, a | 0) | 0;
          f[n >> 2] = d;
          d =
            (i -
              ((j | 0) > -1 ? j : (0 - j) | 0) -
              ((d | 0) > -1 ? d : (0 - d) | 0)) |
            0;
          g = o;
          d = h ? d : (0 - d) | 0;
        }
        f[g >> 2] = d;
        j = f[x >> 2] | 0;
        h = f[n >> 2] | 0;
        D = f[o >> 2] | 0;
        if (
          ((((h | 0) > -1 ? h : (0 - h) | 0) +
            ((j | 0) > -1 ? j : (0 - j) | 0) +
            ((D | 0) > -1 ? D : (0 - D) | 0)) |
            0) !=
          (i | 0)
        ) {
          d = 18;
          break;
        }
        D = km(m) | 0;
        d = f[x >> 2] | 0;
        if (D) {
          d = (0 - d) | 0;
          g = (0 - (f[n >> 2] | 0)) | 0;
          i = (0 - (f[o >> 2] | 0)) | 0;
          f[x >> 2] = d;
          f[n >> 2] = g;
          f[o >> 2] = i;
        } else {
          g = f[n >> 2] | 0;
          i = f[o >> 2] | 0;
        }
        a = (d | 0) > -1;
        h = (g | 0) > -1 ? g : (0 - g) | 0;
        e = (i | 0) > -1 ? i : (0 - i) | 0;
        j = (h + (a ? d : (0 - d) | 0) + e) | 0;
        if ((j | 0) != (f[r >> 2] | 0)) {
          d = 23;
          break;
        }
        if (!a) {
          if ((g | 0) < 0) d = e;
          else d = ((f[s >> 2] | 0) - e) | 0;
          if ((i | 0) < 0) {
            g = d;
            d = h;
          } else {
            g = d;
            d = ((f[s >> 2] | 0) - h) | 0;
          }
        } else {
          g = (j + g) | 0;
          d = (j + i) | 0;
        }
        e = (g | 0) == 0;
        a = (d | 0) == 0;
        h = f[s >> 2] | 0;
        do
          if (
            (d | g | 0) != 0
              ? (
                  (A = (h | 0) == (d | 0)),
                  (B = (h | 0) == (g | 0)),
                  !((e & A) | (a & B))
                )
              : 0
          ) {
            if (e & ((j | 0) < (d | 0))) {
              g = 0;
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (d | 0)) & B) {
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (g | 0)) & A) {
              g = ((j << 1) - g) | 0;
              break;
            } else {
              g = ((j | 0) < (g | 0)) & a ? ((j << 1) - g) | 0 : g;
              break;
            }
          } else {
            g = h;
            d = h;
          }
        while (0);
        f[y >> 2] = g;
        f[l >> 2] = d;
        d = k << 1;
        Hj(z, y, (b + (d << 2)) | 0, (c + (d << 2)) | 0);
        d = (k + 1) | 0;
        if ((d | 0) >= (q | 0)) {
          d = 11;
          break;
        }
        g = f[p >> 2] | 0;
        k = d;
      }
      if ((d | 0) == 11) {
        u = C;
        return 1;
      } else if ((d | 0) == 18) Ga(12778, 12575, 116, 12732);
      else if ((d | 0) == 23) Ga(12845, 10407, 99, 12933);
      return 0;
    }
    function Uc(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0;
      C = u;
      u = (u + 32) | 0;
      w = (C + 28) | 0;
      x = (C + 16) | 0;
      y = (C + 8) | 0;
      v = C;
      z = (a + 8) | 0;
      d = f[(a + 12) >> 2] | 0;
      if ((d | 0) <= 1) Ga(10396, 10407, 60, 10522);
      if ((d | 0) >= 31) Ga(10542, 10407, 61, 10522);
      f[(a + 76) >> 2] = d;
      t = 1 << d;
      f[(a + 80) >> 2] = t + -1;
      t = (t + -2) | 0;
      s = (a + 84) | 0;
      f[s >> 2] = t;
      r = (a + 88) | 0;
      f[r >> 2] = ((t | 0) / 2) | 0;
      t = (a + 44) | 0;
      f[(a + 52) >> 2] = g;
      if (!(Sa[f[((f[a >> 2] | 0) + 16) >> 2] & 255](a) | 0))
        Ga(11762, 12575, 99, 12732);
      if ((e | 0) != 2) Ga(12754, 12575, 102, 12732);
      p = (a + 40) | 0;
      d = f[p >> 2] | 0;
      o = ((f[(d + 4) >> 2] | 0) - (f[d >> 2] | 0)) | 0;
      q = o >> 2;
      f[x >> 2] = 0;
      f[(x + 4) >> 2] = 0;
      f[(x + 8) >> 2] = 0;
      if ((o | 0) <= 0) {
        u = C;
        return 1;
      }
      n = (x + 4) | 0;
      o = (x + 8) | 0;
      m = (a + 92) | 0;
      l = (y + 4) | 0;
      g = d;
      k = 0;
      while (1) {
        d = f[g >> 2] | 0;
        if (((f[(g + 4) >> 2] | 0) - d) >> 2 >>> 0 <= k >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[v >> 2] = f[(d + (k << 2)) >> 2];
        f[w >> 2] = f[v >> 2];
        Vb(t, w, x);
        d = f[x >> 2] | 0;
        a = (d | 0) > -1 ? d : (0 - d) | 0;
        g = f[n >> 2] | 0;
        e = (g | 0) > -1 ? g : (0 - g) | 0;
        a =
          sq(
            e | 0,
            (((e | 0) < 0) << 31 >> 31) | 0,
            a | 0,
            (((a | 0) < 0) << 31 >> 31) | 0
          ) | 0;
        e = f[o >> 2] | 0;
        h = (e | 0) > -1;
        e = h ? e : (0 - e) | 0;
        e = sq(a | 0, I | 0, e | 0, (((e | 0) < 0) << 31 >> 31) | 0) | 0;
        a = I;
        i = f[r >> 2] | 0;
        if (((e | 0) == 0) & ((a | 0) == 0)) {
          g = x;
          d = i;
        } else {
          D = ((i | 0) < 0) << 31 >> 31;
          j = Wo(i | 0, D | 0, d | 0, (((d | 0) < 0) << 31 >> 31) | 0) | 0;
          j = Tl(j | 0, I | 0, e | 0, a | 0) | 0;
          f[x >> 2] = j;
          d = Wo(i | 0, D | 0, g | 0, (((g | 0) < 0) << 31 >> 31) | 0) | 0;
          d = Tl(d | 0, I | 0, e | 0, a | 0) | 0;
          f[n >> 2] = d;
          d =
            (i -
              ((j | 0) > -1 ? j : (0 - j) | 0) -
              ((d | 0) > -1 ? d : (0 - d) | 0)) |
            0;
          g = o;
          d = h ? d : (0 - d) | 0;
        }
        f[g >> 2] = d;
        j = f[x >> 2] | 0;
        h = f[n >> 2] | 0;
        D = f[o >> 2] | 0;
        if (
          ((((h | 0) > -1 ? h : (0 - h) | 0) +
            ((j | 0) > -1 ? j : (0 - j) | 0) +
            ((D | 0) > -1 ? D : (0 - D) | 0)) |
            0) !=
          (i | 0)
        ) {
          d = 18;
          break;
        }
        D = km(m) | 0;
        d = f[x >> 2] | 0;
        if (D) {
          d = (0 - d) | 0;
          g = (0 - (f[n >> 2] | 0)) | 0;
          i = (0 - (f[o >> 2] | 0)) | 0;
          f[x >> 2] = d;
          f[n >> 2] = g;
          f[o >> 2] = i;
        } else {
          g = f[n >> 2] | 0;
          i = f[o >> 2] | 0;
        }
        a = (d | 0) > -1;
        h = (g | 0) > -1 ? g : (0 - g) | 0;
        e = (i | 0) > -1 ? i : (0 - i) | 0;
        j = (h + (a ? d : (0 - d) | 0) + e) | 0;
        if ((j | 0) != (f[r >> 2] | 0)) {
          d = 23;
          break;
        }
        if (!a) {
          if ((g | 0) < 0) d = e;
          else d = ((f[s >> 2] | 0) - e) | 0;
          if ((i | 0) < 0) {
            g = d;
            d = h;
          } else {
            g = d;
            d = ((f[s >> 2] | 0) - h) | 0;
          }
        } else {
          g = (j + g) | 0;
          d = (j + i) | 0;
        }
        e = (g | 0) == 0;
        a = (d | 0) == 0;
        h = f[s >> 2] | 0;
        do
          if (
            (d | g | 0) != 0
              ? (
                  (A = (h | 0) == (d | 0)),
                  (B = (h | 0) == (g | 0)),
                  !((e & A) | (a & B))
                )
              : 0
          ) {
            if (e & ((j | 0) < (d | 0))) {
              g = 0;
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (d | 0)) & B) {
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (g | 0)) & A) {
              g = ((j << 1) - g) | 0;
              break;
            } else {
              g = ((j | 0) < (g | 0)) & a ? ((j << 1) - g) | 0 : g;
              break;
            }
          } else {
            g = h;
            d = h;
          }
        while (0);
        f[y >> 2] = g;
        f[l >> 2] = d;
        d = k << 1;
        Kj(z, y, (b + (d << 2)) | 0, (c + (d << 2)) | 0);
        d = (k + 1) | 0;
        if ((d | 0) >= (q | 0)) {
          d = 11;
          break;
        }
        g = f[p >> 2] | 0;
        k = d;
      }
      if ((d | 0) == 11) {
        u = C;
        return 1;
      } else if ((d | 0) == 18) Ga(12778, 12575, 116, 12732);
      else if ((d | 0) == 23) Ga(12845, 10407, 99, 12933);
      return 0;
    }
    function Vc(a, b, c, d, e, g) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      var h = 0,
        i = 0,
        j = 0,
        k = 0,
        l = 0,
        m = 0,
        n = 0,
        o = 0,
        p = 0,
        q = 0,
        r = 0,
        s = 0,
        t = 0,
        v = 0,
        w = 0,
        x = 0,
        y = 0,
        z = 0,
        A = 0,
        B = 0,
        C = 0,
        D = 0;
      C = u;
      u = (u + 32) | 0;
      w = (C + 28) | 0;
      x = (C + 16) | 0;
      y = (C + 8) | 0;
      v = C;
      z = (a + 8) | 0;
      d = f[(a + 12) >> 2] | 0;
      if ((d | 0) <= 1) Ga(10396, 10407, 60, 10522);
      if ((d | 0) >= 31) Ga(10542, 10407, 61, 10522);
      f[(a + 76) >> 2] = d;
      t = 1 << d;
      f[(a + 80) >> 2] = t + -1;
      t = (t + -2) | 0;
      s = (a + 84) | 0;
      f[s >> 2] = t;
      r = (a + 88) | 0;
      f[r >> 2] = ((t | 0) / 2) | 0;
      t = (a + 44) | 0;
      f[(a + 52) >> 2] = g;
      if (!(Sa[f[((f[a >> 2] | 0) + 16) >> 2] & 255](a) | 0))
        Ga(11762, 12575, 99, 12732);
      if ((e | 0) != 2) Ga(12754, 12575, 102, 12732);
      p = (a + 40) | 0;
      d = f[p >> 2] | 0;
      o = ((f[(d + 4) >> 2] | 0) - (f[d >> 2] | 0)) | 0;
      q = o >> 2;
      f[x >> 2] = 0;
      f[(x + 4) >> 2] = 0;
      f[(x + 8) >> 2] = 0;
      if ((o | 0) <= 0) {
        u = C;
        return 1;
      }
      n = (x + 4) | 0;
      o = (x + 8) | 0;
      m = (a + 92) | 0;
      l = (y + 4) | 0;
      g = d;
      k = 0;
      while (1) {
        d = f[g >> 2] | 0;
        if (((f[(g + 4) >> 2] | 0) - d) >> 2 >>> 0 <= k >>> 0) {
          wr(g);
          d = f[g >> 2] | 0;
        }
        f[v >> 2] = f[(d + (k << 2)) >> 2];
        f[w >> 2] = f[v >> 2];
        Tb(t, w, x);
        d = f[x >> 2] | 0;
        a = (d | 0) > -1 ? d : (0 - d) | 0;
        g = f[n >> 2] | 0;
        e = (g | 0) > -1 ? g : (0 - g) | 0;
        a =
          sq(
            e | 0,
            (((e | 0) < 0) << 31 >> 31) | 0,
            a | 0,
            (((a | 0) < 0) << 31 >> 31) | 0
          ) | 0;
        e = f[o >> 2] | 0;
        h = (e | 0) > -1;
        e = h ? e : (0 - e) | 0;
        e = sq(a | 0, I | 0, e | 0, (((e | 0) < 0) << 31 >> 31) | 0) | 0;
        a = I;
        i = f[r >> 2] | 0;
        if (((e | 0) == 0) & ((a | 0) == 0)) {
          g = x;
          d = i;
        } else {
          D = ((i | 0) < 0) << 31 >> 31;
          j = Wo(i | 0, D | 0, d | 0, (((d | 0) < 0) << 31 >> 31) | 0) | 0;
          j = Tl(j | 0, I | 0, e | 0, a | 0) | 0;
          f[x >> 2] = j;
          d = Wo(i | 0, D | 0, g | 0, (((g | 0) < 0) << 31 >> 31) | 0) | 0;
          d = Tl(d | 0, I | 0, e | 0, a | 0) | 0;
          f[n >> 2] = d;
          d =
            (i -
              ((j | 0) > -1 ? j : (0 - j) | 0) -
              ((d | 0) > -1 ? d : (0 - d) | 0)) |
            0;
          g = o;
          d = h ? d : (0 - d) | 0;
        }
        f[g >> 2] = d;
        j = f[x >> 2] | 0;
        h = f[n >> 2] | 0;
        D = f[o >> 2] | 0;
        if (
          ((((h | 0) > -1 ? h : (0 - h) | 0) +
            ((j | 0) > -1 ? j : (0 - j) | 0) +
            ((D | 0) > -1 ? D : (0 - D) | 0)) |
            0) !=
          (i | 0)
        ) {
          d = 18;
          break;
        }
        D = km(m) | 0;
        d = f[x >> 2] | 0;
        if (D) {
          d = (0 - d) | 0;
          g = (0 - (f[n >> 2] | 0)) | 0;
          i = (0 - (f[o >> 2] | 0)) | 0;
          f[x >> 2] = d;
          f[n >> 2] = g;
          f[o >> 2] = i;
        } else {
          g = f[n >> 2] | 0;
          i = f[o >> 2] | 0;
        }
        a = (d | 0) > -1;
        h = (g | 0) > -1 ? g : (0 - g) | 0;
        e = (i | 0) > -1 ? i : (0 - i) | 0;
        j = (h + (a ? d : (0 - d) | 0) + e) | 0;
        if ((j | 0) != (f[r >> 2] | 0)) {
          d = 23;
          break;
        }
        if (!a) {
          if ((g | 0) < 0) d = e;
          else d = ((f[s >> 2] | 0) - e) | 0;
          if ((i | 0) < 0) {
            g = d;
            d = h;
          } else {
            g = d;
            d = ((f[s >> 2] | 0) - h) | 0;
          }
        } else {
          g = (j + g) | 0;
          d = (j + i) | 0;
        }
        e = (g | 0) == 0;
        a = (d | 0) == 0;
        h = f[s >> 2] | 0;
        do
          if (
            (d | g | 0) != 0
              ? (
                  (A = (h | 0) == (d | 0)),
                  (B = (h | 0) == (g | 0)),
                  !((e & A) | (a & B))
                )
              : 0
          ) {
            if (e & ((j | 0) < (d | 0))) {
              g = 0;
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (d | 0)) & B) {
              d = ((j << 1) - d) | 0;
              break;
            }
            if (((j | 0) > (g | 0)) & A) {
              g = ((j << 1) - g) | 0;
              break;
            } else {
              g = ((j | 0) < (g | 0)) & a ? ((j << 1) - g) | 0 : g;
              break;
            }
          } else {
            g = h;
            d = h;
          }
        while (0);
        f[y >> 2] = g;
        f[l >> 2] = d;
        d = k << 1;
        Kj(z, y, (b + (d << 2)) | 0, (c + (d << 2)) | 0);
        d = (k + 1) | 0;
        if ((d | 0) >= (q | 0)) {
          d = 11;
          break;
        }
        g = f[p >> 2] | 0;
        k = d;
      }
      if ((d | 0) == 11) {
        u = C;
        return 1;
      } else if ((d | 0) == 18) Ga(12778, 12575, 116, 12732);
      else if ((d | 0) == 23) Ga(12845, 10407, 99, 12933);
      return 0;
    }
    function Wc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = 0,
        j = 0,
        k = 0,
        l = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          k = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          i = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                k | 0,
                (((k | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 4, 0) | 0;
          k = I;
          i = f[a >> 2] | 0;
          g = f[i >> 2] | 0;
          if (
            ((k | 0) > 0) |
            ((k | 0) == 0
              ? j >>> 0 > (((f[(i + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          l = $(
            h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24) |
              0
          );
          e = $(l * $(4.65661287e-10));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? l : e;
          k = (d + 4) | 0;
          f[k >> 2] = 0;
          f[(k + 4) >> 2] = 0;
          k = 1;
          return k | 0;
        }
        case 2: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 8, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          c = (g + c) | 0;
          k = c;
          c = (c + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          e = $(
            h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c | 0);
          } else {
            e = $(e * $(4.65661287e-10));
            n[d >> 2] = e;
            e = $($(c | 0) * $(4.65661287e-10));
          }
          n[(d + 4) >> 2] = e;
          n[(d + 8) >> 2] = $(0.0);
          k = 1;
          return k | 0;
        }
        case 3: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 12, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          c = (k + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (k + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            l = $(c | 0);
            n[(d + 4) >> 2] = l;
            l = $(g | 0);
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          } else {
            l = $(e * $(4.65661287e-10));
            n[d >> 2] = l;
            l = $($(c | 0) * $(4.65661287e-10));
            n[(d + 4) >> 2] = l;
            l = $($(g | 0) * $(4.65661287e-10));
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          }
        }
        case 4: {
          i = f[c >> 2] | 0;
          c = (a + 48) | 0;
          j = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          k = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[k >> 2] | 0,
                f[(k + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              j | 0,
              c | 0
            ) | 0;
          j = sq(c | 0, I | 0, 16, 0) | 0;
          i = I;
          k = f[a >> 2] | 0;
          g = f[k >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? j >>> 0 > (((f[(k + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            k = 0;
            return k | 0;
          }
          k = (g + c) | 0;
          c = (k + 4) | 0;
          c =
            h[c >> 0] |
            (h[(c + 1) >> 0] << 8) |
            (h[(c + 2) >> 0] << 16) |
            (h[(c + 3) >> 0] << 24);
          g = (k + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          e = $(
            h[k >> 0] |
              (h[(k + 1) >> 0] << 8) |
              (h[(k + 2) >> 0] << 16) |
              (h[(k + 3) >> 0] << 24) |
              0
          );
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            l = $(c | 0);
            n[(d + 4) >> 2] = l;
            l = $(g | 0);
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          } else {
            l = $(e * $(4.65661287e-10));
            n[d >> 2] = l;
            l = $($(c | 0) * $(4.65661287e-10));
            n[(d + 4) >> 2] = l;
            l = $($(g | 0) * $(4.65661287e-10));
            n[(d + 8) >> 2] = l;
            k = 1;
            return k | 0;
          }
        }
        default: {
          k = 0;
          return k | 0;
        }
      }
      return 0;
    }
    function Xc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = La,
        j = 0,
        k = 0,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 2, 0) | 0;
          l = I;
          j = f[a >> 2] | 0;
          g = f[j >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? k >>> 0 > (((f[(j + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          e = $((h[l >> 0] | (h[(l + 1) >> 0] << 8)) << 16 >> 16);
          i = $(e / $(32767.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? e : i;
          l = (d + 4) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          f[(l + 8) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 4, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          l =
            h[l >> 0] |
            (h[(l + 1) >> 0] << 8) |
            (h[(l + 2) >> 0] << 16) |
            (h[(l + 3) >> 0] << 24);
          c = (l >>> 16) & 65535;
          e = $((l & 65535) << 16 >> 16);
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c << 16 >> 16);
          } else {
            e = $(e / $(32767.0));
            n[d >> 2] = e;
            e = $($(c << 16 >> 16) / $(32767.0));
          }
          n[(d + 4) >> 2] = e;
          l = (d + 8) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 3: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 6, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 2) | 0;
          c = h[c >> 0] | (h[(c + 1) >> 0] << 8);
          g = (l + 4) | 0;
          g = h[g >> 0] | (h[(g + 1) >> 0] << 8);
          e = $((h[l >> 0] | (h[(l + 1) >> 0] << 8)) << 16 >> 16);
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c << 16 >> 16);
            e = $(g << 16 >> 16);
          } else {
            i = $(e / $(32767.0));
            n[d >> 2] = i;
            i = $($(c << 16 >> 16) / $(32767.0));
            e = $($(g << 16 >> 16) / $(32767.0));
          }
          n[(d + 4) >> 2] = i;
          n[(d + 8) >> 2] = e;
          n[(d + 12) >> 2] = $(0.0);
          l = 1;
          return l | 0;
        }
        case 4: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 8, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          j = (g + c) | 0;
          k = j;
          k =
            h[k >> 0] |
            (h[(k + 1) >> 0] << 8) |
            (h[(k + 2) >> 0] << 16) |
            (h[(k + 3) >> 0] << 24);
          j = (j + 4) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          l = (b[(a + 32) >> 0] | 0) == 0;
          c = (Ep(k | 0, j | 0, 16) | 0) & 65535;
          g = j & 65535;
          a = (Ep(k | 0, j | 0, 48) | 0) & 65535;
          e = $((k & 65535) << 16 >> 16);
          if (l) {
            n[d >> 2] = e;
            i = $(c << 16 >> 16);
            n[(d + 4) >> 2] = i;
            i = $(g << 16 >> 16);
            n[(d + 8) >> 2] = i;
            i = $(a << 16 >> 16);
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          } else {
            i = $(e / $(32767.0));
            n[d >> 2] = i;
            i = $($(c << 16 >> 16) / $(32767.0));
            n[(d + 4) >> 2] = i;
            i = $($(g << 16 >> 16) / $(32767.0));
            n[(d + 8) >> 2] = i;
            i = $($(a << 16 >> 16) / $(32767.0));
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          }
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function Yc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0,
        k = La,
        l = La,
        m = La;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          i = (c + e) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          i = ~~$(n[s >> 2]);
          f[d >> 2] = i;
          i = (d + 4) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          i = j;
          j = (j + 4) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          i = ~~(
            (f[s >> 2] =
              h[i >> 0] |
              (h[(i + 1) >> 0] << 8) |
              (h[(i + 2) >> 0] << 16) |
              (h[(i + 3) >> 0] << 24)),
            $(n[s >> 2])
          );
          f[d >> 2] = i;
          j = ~~((f[s >> 2] = j), $(n[s >> 2]));
          f[(d + 4) >> 2] = j;
          f[(d + 8) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          m = $(n[s >> 2]);
          i = (j + 4) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          l = $(n[s >> 2]);
          j = (j + 8) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          k = $(n[s >> 2]);
          f[d >> 2] = ~~m;
          f[(d + 4) >> 2] = ~~l;
          f[(d + 8) >> 2] = ~~k;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          j = (c + e) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          k = $(n[s >> 2]);
          i = (j + 4) | 0;
          b[s >> 0] = b[i >> 0];
          b[(s + 1) >> 0] = b[(i + 1) >> 0];
          b[(s + 2) >> 0] = b[(i + 2) >> 0];
          b[(s + 3) >> 0] = b[(i + 3) >> 0];
          l = $(n[s >> 2]);
          j = (j + 8) | 0;
          b[s >> 0] = b[j >> 0];
          b[(s + 1) >> 0] = b[(j + 1) >> 0];
          b[(s + 2) >> 0] = b[(j + 2) >> 0];
          b[(s + 3) >> 0] = b[(j + 3) >> 0];
          m = $(n[s >> 2]);
          f[d >> 2] = ~~k;
          f[(d + 4) >> 2] = ~~l;
          f[(d + 8) >> 2] = ~~m;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function Zc(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = La,
        g = 0,
        i = La,
        j = 0,
        k = 0,
        l = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          l = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          j = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                l | 0,
                (((l | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 2, 0) | 0;
          l = I;
          j = f[a >> 2] | 0;
          g = f[j >> 2] | 0;
          if (
            ((l | 0) > 0) |
            ((l | 0) == 0
              ? k >>> 0 > (((f[(j + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          e = $((h[l >> 0] | (h[(l + 1) >> 0] << 8)) & 65535);
          i = $(e / $(65535.0));
          n[d >> 2] = (b[(a + 32) >> 0] | 0) == 0 ? e : i;
          l = (d + 4) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          f[(l + 8) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 4, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          l =
            h[l >> 0] |
            (h[(l + 1) >> 0] << 8) |
            (h[(l + 2) >> 0] << 16) |
            (h[(l + 3) >> 0] << 24);
          c = (l >>> 16) & 65535;
          e = $(l & 65535);
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            e = $(c & 65535);
          } else {
            e = $(e / $(65535.0));
            n[d >> 2] = e;
            e = $($(c & 65535) / $(65535.0));
          }
          n[(d + 4) >> 2] = e;
          l = (d + 8) | 0;
          f[l >> 2] = 0;
          f[(l + 4) >> 2] = 0;
          l = 1;
          return l | 0;
        }
        case 3: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 6, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          l = (g + c) | 0;
          c = (l + 2) | 0;
          c = h[c >> 0] | (h[(c + 1) >> 0] << 8);
          g = (l + 4) | 0;
          g = h[g >> 0] | (h[(g + 1) >> 0] << 8);
          e = $((h[l >> 0] | (h[(l + 1) >> 0] << 8)) & 65535);
          if (!(b[(a + 32) >> 0] | 0)) {
            n[d >> 2] = e;
            i = $(c & 65535);
            e = $(g & 65535);
          } else {
            i = $(e / $(65535.0));
            n[d >> 2] = i;
            i = $($(c & 65535) / $(65535.0));
            e = $($(g & 65535) / $(65535.0));
          }
          n[(d + 4) >> 2] = i;
          n[(d + 8) >> 2] = e;
          n[(d + 12) >> 2] = $(0.0);
          l = 1;
          return l | 0;
        }
        case 4: {
          j = f[c >> 2] | 0;
          c = (a + 48) | 0;
          k = f[c >> 2] | 0;
          c = f[(c + 4) >> 2] | 0;
          l = (a + 40) | 0;
          c =
            sq(
              Wo(
                f[l >> 2] | 0,
                f[(l + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              k | 0,
              c | 0
            ) | 0;
          k = sq(c | 0, I | 0, 8, 0) | 0;
          j = I;
          l = f[a >> 2] | 0;
          g = f[l >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? k >>> 0 > (((f[(l + 4) >> 2] | 0) - g) | 0) >>> 0
              : 0)
          ) {
            l = 0;
            return l | 0;
          }
          j = (g + c) | 0;
          k = j;
          k =
            h[k >> 0] |
            (h[(k + 1) >> 0] << 8) |
            (h[(k + 2) >> 0] << 16) |
            (h[(k + 3) >> 0] << 24);
          j = (j + 4) | 0;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          l = (b[(a + 32) >> 0] | 0) == 0;
          c = (Ep(k | 0, j | 0, 16) | 0) & 65535;
          g = j & 65535;
          a = (Ep(k | 0, j | 0, 48) | 0) & 65535;
          e = $(k & 65535);
          if (l) {
            n[d >> 2] = e;
            i = $(c & 65535);
            n[(d + 4) >> 2] = i;
            i = $(g & 65535);
            n[(d + 8) >> 2] = i;
            i = $(a & 65535);
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          } else {
            i = $(e / $(65535.0));
            n[d >> 2] = i;
            i = $($(c & 65535) / $(65535.0));
            n[(d + 4) >> 2] = i;
            i = $($(g & 65535) / $(65535.0));
            n[(d + 8) >> 2] = i;
            i = $($(a & 65535) / $(65535.0));
            n[(d + 12) >> 2] = i;
            l = 1;
            return l | 0;
          }
        }
        default: {
          l = 0;
          return l | 0;
        }
      }
      return 0;
    }
    function _c(a, c, d) {
      a = a | 0;
      c = c | 0;
      d = d | 0;
      var e = 0,
        g = 0,
        i = 0,
        j = 0;
      switch (b[(a + 24) >> 0] | 0) {
        case 1: {
          i = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          c = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[c >> 2] | 0,
                f[(c + 4) >> 2] | 0,
                i | 0,
                (((i | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 4, 0) | 0;
          i = I;
          a = f[a >> 2] | 0;
          c = f[a >> 2] | 0;
          if (
            ((i | 0) > 0) |
            ((i | 0) == 0
              ? g >>> 0 > (((f[(a + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            i = 0;
            return i | 0;
          }
          g = (c + e) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = d;
          f[i >> 2] = g;
          f[(i + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          i = (d + 8) | 0;
          f[i >> 2] = 0;
          f[(i + 4) >> 2] = 0;
          f[(i + 8) >> 2] = 0;
          f[(i + 12) >> 2] = 0;
          f[(i + 16) >> 2] = 0;
          f[(i + 20) >> 2] = 0;
          i = 1;
          return i | 0;
        }
        case 2: {
          j = f[c >> 2] | 0;
          e = (a + 48) | 0;
          g = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          i = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[i >> 2] | 0,
                f[(i + 4) >> 2] | 0,
                j | 0,
                (((j | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              g | 0,
              e | 0
            ) | 0;
          g = sq(e | 0, I | 0, 8, 0) | 0;
          j = I;
          i = f[a >> 2] | 0;
          c = f[i >> 2] | 0;
          if (
            ((j | 0) > 0) |
            ((j | 0) == 0
              ? g >>> 0 > (((f[(i + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          j = i;
          j =
            h[j >> 0] |
            (h[(j + 1) >> 0] << 8) |
            (h[(j + 2) >> 0] << 16) |
            (h[(j + 3) >> 0] << 24);
          i = (i + 4) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          a = lp(0, j | 0, 32) | 0;
          g = d;
          f[g >> 2] = a;
          f[(g + 4) >> 2] = I;
          i = lp(j | 0, i | 0, 32) | 0;
          j = (d + 8) | 0;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = I;
          j = (d + 16) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          f[(j + 8) >> 2] = 0;
          f[(j + 12) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 3: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 12, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          a =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          g = (i + 4) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = (i + 8) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] = a;
          f[(j + 4) >> 2] = ((a | 0) < 0) << 31 >> 31;
          j = (d + 8) | 0;
          f[j >> 2] = g;
          f[(j + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          j = (d + 16) | 0;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = (d + 24) | 0;
          f[j >> 2] = 0;
          f[(j + 4) >> 2] = 0;
          j = 1;
          return j | 0;
        }
        case 4: {
          g = f[c >> 2] | 0;
          e = (a + 48) | 0;
          i = f[e >> 2] | 0;
          e = f[(e + 4) >> 2] | 0;
          j = (a + 40) | 0;
          e =
            sq(
              Wo(
                f[j >> 2] | 0,
                f[(j + 4) >> 2] | 0,
                g | 0,
                (((g | 0) < 0) << 31 >> 31) | 0
              ) | 0,
              I | 0,
              i | 0,
              e | 0
            ) | 0;
          i = sq(e | 0, I | 0, 16, 0) | 0;
          g = I;
          j = f[a >> 2] | 0;
          c = f[j >> 2] | 0;
          if (
            ((g | 0) > 0) |
            ((g | 0) == 0
              ? i >>> 0 > (((f[(j + 4) >> 2] | 0) - c) | 0) >>> 0
              : 0)
          ) {
            j = 0;
            return j | 0;
          }
          i = (c + e) | 0;
          e =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          a = (i + 4) | 0;
          a =
            h[a >> 0] |
            (h[(a + 1) >> 0] << 8) |
            (h[(a + 2) >> 0] << 16) |
            (h[(a + 3) >> 0] << 24);
          g = (i + 8) | 0;
          g =
            h[g >> 0] |
            (h[(g + 1) >> 0] << 8) |
            (h[(g + 2) >> 0] << 16) |
            (h[(g + 3) >> 0] << 24);
          i = (i + 12) | 0;
          i =
            h[i >> 0] |
            (h[(i + 1) >> 0] << 8) |
            (h[(i + 2) >> 0] << 16) |
            (h[(i + 3) >> 0] << 24);
          j = d;
          f[j >> 2] = e;
          f[(j + 4) >> 2] = ((e | 0) < 0) << 31 >> 31;
          j = (d + 8) | 0;
          f[j >> 2] = a;
          f[(j + 4) >> 2] = ((a | 0) < 0) << 31 >> 31;
          j = (d + 16) | 0;
          f[j >> 2] = g;
          f[(j + 4) >> 2] = ((g | 0) < 0) << 31 >> 31;
          j = (d + 24) | 0;
          f[j >> 2] = i;
          f[(j + 4) >> 2] = ((i | 0) < 0) << 31 >> 31;
          j = 1;
          return j | 0;
        }
        default: {
          j = 0;
          return j | 0;
        }
      }
      return 0;
    }
    function $c(a, b, c, d, e, g, h) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      h = h | 0;
      switch (c | 0) {
        case 1: {
          b = Xo(44) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3244;
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 2: {
          b = Xo(44) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3300;
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 4: {
          b = Xo(96) | 0;
          f[(b + 4) >> 2] = d;
          h = (b + 12) | 0;
          c = (e + 4) | 0;
          f[h >> 2] = f[c >> 2];
          f[(h + 4) >> 2] = f[(c + 4) >> 2];
          f[(h + 8) >> 2] = f[(c + 8) >> 2];
          f[(h + 12) >> 2] = f[(c + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          h = (b + 28) | 0;
          f[h >> 2] = f[g >> 2];
          f[(h + 4) >> 2] = f[(g + 4) >> 2];
          f[(h + 8) >> 2] = f[(g + 8) >> 2];
          f[(h + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3356;
          h = (b + 44) | 0;
          c = (h + 52) | 0;
          do {
            f[h >> 2] = 0;
            h = (h + 4) | 0;
          } while ((h | 0) < (c | 0));
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 3: {
          b = Xo(76) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3412;
          e = (b + 44) | 0;
          f[e >> 2] = 0;
          f[(e + 4) >> 2] = 0;
          f[(e + 8) >> 2] = 0;
          f[(e + 12) >> 2] = 0;
          f[(e + 16) >> 2] = 0;
          f[(e + 20) >> 2] = 0;
          f[(e + 24) >> 2] = 0;
          f[(b + 72) >> 2] = h & 65535;
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 5: {
          b = Xo(88) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3468;
          f[(b + 44) >> 2] = 0;
          f[(b + 48) >> 2] = 0;
          f[(b + 60) >> 2] = 0;
          f[(b + 64) >> 2] = 0;
          f[(b + 68) >> 2] = 0;
          e = (b + 72) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 6: {
          b = Xo(108) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 3524;
          f[(b + 48) >> 2] = 0;
          f[(b + 52) >> 2] = 0;
          e = (b + 56) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[(b + 44) >> 2] = 3580;
          f[(b + 72) >> 2] = 1;
          e = (b + 76) | 0;
          f[e >> 2] = -1;
          f[(e + 4) >> 2] = -1;
          f[(e + 8) >> 2] = -1;
          f[(e + 12) >> 2] = -1;
          is((b + 92) | 0);
          e = b;
          f[a >> 2] = e;
          return;
        }
        default: {
          e = 0;
          f[a >> 2] = e;
          return;
        }
      }
    }
    function ad(a, b, c, d, e, g, h) {
      a = a | 0;
      b = b | 0;
      c = c | 0;
      d = d | 0;
      e = e | 0;
      g = g | 0;
      h = h | 0;
      switch (c | 0) {
        case 1: {
          b = Xo(44) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          f[b >> 2] = 2880;
          e = b;
          f[a >> 2] = e;
          return;
        }
        case 2: {
          b = Xo(44) | 0;
          f[(b + 4) >> 2] = d;
          d = (b + 12) | 0;
          e = (e + 4) | 0;
          f[d >> 2] = f[e >> 2];
          f[(d + 4) >> 2] = f[(e + 4) >> 2];
          f[(d + 8) >> 2] = f[(e + 8) >> 2];
          f[(d + 12) >> 2] = f[(e + 12) >> 2];
          f[(b + 8) >> 2] = 2804;
          e = (b + 28) | 0;
          f[e >> 2] = f[g >> 2];
          f[(e + 4) >> 2] = f[(g + 4) >> 2];
          f[(e + 8) >> 2] = f[(g + 8) >> 2];
          f[(e + 12) >> 2] = f[(g + 12) >> 2];
          e = b;
    }