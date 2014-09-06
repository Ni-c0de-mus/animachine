var EventEmitter = require('events').EventEmitter;
var inherits = require('inherits');
var amgui = require('../../amgui');
var CssParameter = require('./CssParameter');
var CssTransformParameter = require('./CssTransformParameter');
var Key = require('./Key');
var Transhand = require('../../transhand/Transhand');
var mstPlayer = require('./script.player.mst');
var DialogSequOptions = require('./DialogSequOptions');

var dialogSequOptions;

function CssSequence(opt) {

    opt = opt || {};

    EventEmitter.call(this);

    CssSequence._instances.push(this);

    if (!dialogSequOptions) {
        dialogSequOptions = new DialogSequOptions();
    }

    this._selectors = opt.selectors || [];
    this._parameters = [];

    this._opt = _.extend({baseH: 21}, opt);

    this._selectedElements = [];
    this._isOpened = false;
    this._headKeys = [];
    this._name = opt._name || this._selectors[0] || 'unnamed';

    this._onSelectClick = this._onSelectClick.bind(this);
    this._onChangeHandler = this._onChangeHandler.bind(this);
    this._onChangeTime = this._onChangeTime.bind(this);
    this._onChangeParameter = this._onChangeParameter.bind(this);
    this._onChangeBlankParameter = this._onChangeBlankParameter.bind(this);
    this._onToggleKey = this._onToggleKey.bind(this);
    this._onClickName = this._onClickName.bind(this);
    this._onChangeName = this._onChangeName.bind(this);
    this._onChangeSelectors = this._onChangeSelectors.bind(this);

    this.deOptions = document.createElement('div');
    this.deKeys = document.createElement('div');

    this._deHeadOptinos = this._createHeadOptions();
    this._deHeadKeyline = amgui.createKeyline({});
    this.deKeys.appendChild(this._deHeadKeyline);

    am.timeline.on('changeTime', this._onChangeTime);
    this.deOptions.addEventListener('click', this._onSelectClick);
    this.deKeys.addEventListener('click', this._onSelectClick);

    this._onChangeBlankParameter();
}

CssSequence._instances = [];

inherits(CssSequence, EventEmitter);
var p = CssSequence.prototype;

p.type = 'css_sequ_type';

p.select = function () {

    if (this._isSelected) return;
    this._isSelected = true;


    if (!this._handler) {
        this._handler = new Transhand();
    }

    this._handler.on('change', this._onChangeHandler);

    this.selectElements();

    if (this._selectedElements.length) {

        this._focusHandler(this._selectedElements[0]);
    }

    this.deHighlight.style.opacity = 1;

    this.emit('select', this);
};

p.deselect = function () {

    if (!this._isSelected) return;
    this._isSelected = false;

    this._blurHandler();

    this.deHighlight.style.opacity = 0;

    if (this._handler) {

        this._handler.removeListener('change', this._onChangeHandler);
    }
};

p.renderTime = function (time) {

    if (this._selectors.length === 0) {
        return;
    }

    var selection = _.toArray(am.deRoot.querySelectorAll(this._selectors.join(',')));

    this._parameters.forEach(function (param) {

        selection.forEach(function (de) {

            de.style[param.name] = param.getValue(time);
        });
    });
};

Object.defineProperty(p, 'height', {

    get: function () {

        var ret = this._opt.baseH;

        if (this._isOpened) {

            this._parameters.forEach(function (param) {

                ret += param.height;
            });
        }

        return ret;
    }
});

p._onPick = function (de) {

    var items = am.deRoot.querySelectorAll(this.selectors.join(','));

    if (items.indexOf(de)) {

        this.select();
    }
};

p._focusHandler = function (de) {

    de = de || this._currHandledDe;
    this._currHandledDe = de;

    if (!this._currHandledDe) return;

    var transformSave;
    if (de.style.transform) {
        transformSave = de.style.transform;
        de.style.transform = '';
    }

    var br = de.getBoundingClientRect();

    de.style.transform = transformSave;

    var handOpt = {
        type: 'transformer',
        base: {
            x: br.left,
            y: br.top,
            w: br.width,
            h: br.height,
        }
    };
    var transformParam = this.getParameter('transform');

    if (transformParam) {

        handOpt.params = transformParam.getRawValue();
    }

    this._handler.setup({
        hand: handOpt
    });
    this._handler.activate();

    am.deHandlerCont.appendChild(this._handler.domElem);
};

p._blurHandler = function () {

    // this._currHandledDe = undefined;

    if (this._handler && this._handler.domElem && this._handler.domElem.parentNode) {

        this._handler.deactivate();
        this._handler.domElem.parentNode.removeChild(this._handler.domElem);
    }
};

p._onSelectClick = function () {

    this.select();
};

p._onChangeHandler = function(params, type) {

    var time = am.timeline.currTime,
        name, prop, value;


    if (type === 'transform') {

        Object.keys(params).forEach(function (name) {

            if (name === 'tx' || name === 'ty' || name === 'tz' ||
                name === 'rx' || name === 'ry' || name === 'rz' ||
                name === 'sx' || name === 'sy' || name === 'sz')
            {
                value = {};
                value[name] = params[name];

                prop = this.addParameter({name: 'transform'});
                prop.addKey({
                    time: time,
                    name: name,
                    value: value
                });
            }
        }, this);

        if ('ox' in params && 'oy' in params) {

            prop = this.addParameter({name: 'transform-origin'});
            prop.addKey({
                time: time,
                name: name,
                value: (params.ox*100) + '% ' + (params.oy*100) + '%'
            });
        }
    }

    this.renderTime(time);
    this._focusHandler();
};

p._onChangeTime = function (time) {

    this._parameters.forEach(function (param) {

        this.renderTime(time);
        this._focusHandler();
        this._refreshBtnToggleKey();
    }, this);
};

p._onChangeParameter = function () {

    this.renderTime();
    this._focusHandler();
    this._refreshHeadKeyline();
    this._refreshBtnToggleKey();

    this.emit('change');
};

p._onChangeBlankParameter = function () {

    if (this._blankParameter) {

        this._blankParameter.removeListener('change', this._onChangeBlankParameter);
    };

    this._blankParameter = this.addParameter();
    this._blankParameter.on('change', this._onChangeBlankParameter);
};

p._onToggleKey = function () {

    var time = am.timeline.currTime;
        allHaveKey = this._isAllParamsHaveKey(time);

    this._parameters.forEach(function (param) {

        if (param.isValid()) {

            if (allHaveKey) {
                param.deleteKey(param.getKey(time));
            }
            else {
                param.addKey({time: time});
            }
        }
    });

    this._refreshBtnToggleKey();
};

p._onClickName = function () {

    dialogSequOptions.show({
        name: this._name,
        selectors: this._selectors,
        onChangeName: this._onChangeName, 
        onChangeSelectors: this._onChangeSelectors
    });
};

p._onChangeName = function (name) {

    this._name = name;
    this._deName.textContent = name;
};

p._onChangeSelectors = function (selectors) {

    this._selectors.length = 0;
    this._selectors = this._selectors.concat(selectors);

    this.selectElements();
};

p._isAllParamsHaveKey = function (time) {

    return this._parameters.every(function (param) {

        return param.getKey(time) || !param.isValid();
    });
};

p.getParameter = function (name) {

    return this._parameters.find(function(param) {

        return param.name === name;
    });
};

p.addParameter = function (opt) {

    opt = opt || {};

    var param = this.getParameter(opt.name);

    if (param) {

        return param
    }
    else {

        if (opt.name === 'transform') {

            param = new CssTransformParameter(opt);
        }
        else {

            param = new CssParameter(opt);
        }

        this._parameters.push(param);
        param.on('change', this._onChangeParameter);

        this.deOptions.appendChild(param.deOptions);
        this.deKeys.appendChild(param.deKeyline);
        this.emit('changeHeight');

        return param;
    }
};

p._refreshBtnToggleKey = function () {

    var allHaveKey = this._isAllParamsHaveKey(am.timeline.currTime);
    this._btnToggleKey.style.color = allHaveKey ? amgui.color.text : 'rgba(255,255,255,.23)';
};


p._refreshHeadKeyline = function () {

    var times = [], oldKeys = this._headKeys.splice(0);

    this._parameters.forEach(function (param) {

        times = times.concat(param.getKeyTimes());
    });

    times = _.uniq(times);

    times.forEach(function (time) {

        var key = oldKeys.pop() || new Key({
            deKeyline: this._deHeadKeyline
        });

        key.time = time;

        this._headKeys.push(key);
    }, this);

    _.invoke(_.difference(oldKeys, this._headKeys), 'dispose');
};

p.getScript = function () {

    var keys = [], code = '', options, selectors,
        longestOffset = 0;

    this._parameters.forEach(function (param) {

        param._keys.forEach(function (key) {

            var offset = key.time,
                kf = getKey(offset);
            
            kf[param.name] = param.getValue(key.time);

            if (key.ease && key.ease !== 'linear') {
               kf.easing = key.ease; 
            }

            if (longestOffset < offset) longestOffset = offset;
        });
    });

    keys.forEach(function (key) {

        key.offset /= longestOffset;
    });

    keys.sort(function (a, b) {

        return a.offset - b.offset;
    });

    function getKey(time) {

        var key = keys.find(function (_key) {
            return time === _key.offset;
        });

        if (!key) {

            key = {offset: time};
            keys.push(key);
        }

        return key;
    }

    options = {
      direction: "normal",
      duration: longestOffset,
      iterations: 1
    };

    selectors = this._selectors.join(',').replace('\\','\\\\');

    code = Mustache.render(mstPlayer, {
        keys: JSON.stringify(keys),
        options: JSON.stringify(options),
        selectors: selectors
    });

    return code;
};

p.getSave = function () {

    var save = {
        selectors: _.clone(this._selectors),
        parameters: [],
    };

    this._parameters.forEach(function (param) {

        save.parameters.push(param.getSave());
    });

    return save;
};

p.useSave = function (save) {

    this._selectors = save.selectors;

    save.parameters.forEach(function (paramData) {
        //hack: give the 'name' on creating the param to have
        //  the 'CssTransformParameter' instance for the 'transform' parameter
        var param = this.addParameter({name: paramData.name});
        param.useSave(paramData);
    }, this);

    return save;
};

p.getMagnetPoints = function () {

    var times = [];

    this._headKeys.forEach(function (key) {

        times.push(key.time);
    });

    return times;
};



p._createHeadOptions = function (){

    var de = document.createElement('div');
    de.style.position = 'relative';
    de.style.width = '100%';
    de.style.display = 'flex';
    de.style.height = this._opt.baseH + 'px';
    de.style.background = 'linear-gradient(to bottom, #063501 18%,#064100 96%)';
    this.deOptions.appendChild(de);

    this.deHighlight = document.createElement('div');
    this.deHighlight.style.display = 'inline-block';
    this.deHighlight.style.width = '2px';
    this.deHighlight.style.height = this._opt.baseH + 'px';
    this.deHighlight.style.background = 'gold';
    this.deHighlight.style.opacity = 0;
    de.appendChild(this.deHighlight);

    this._deToggleDropDown = amgui.createToggleIconBtn({
        iconOn: 'angle-down',
        iconOff: 'angle-right',
        height: this._opt.baseH,
    });
    this._deToggleDropDown.addEventListener('toggle', function (e) {
        this._isOpened = e.detail.state;
        this.emit('changeHeight', this.height);
    }.bind(this));
    this._deToggleDropDown.style.display = 'inline-block';
    de.appendChild(this._deToggleDropDown);

    this._deName = amgui.createLabel({caption: this._name, parent: de});
    this._deName.style.height = this._opt.baseH  + 'px';
    this._deName.addEventListener('click', this._onClickName);

    this._btnToggleKey = amgui.createIconBtn({icon: 'key', height: this._opt.baseH});
    this._btnToggleKey.style.position = 'absolute';
    this._btnToggleKey.style.right = '0px';
    this._btnToggleKey.style.top = '0px';
    this._btnToggleKey.addEventListener('click', this._onToggleKey);
    de.appendChild(this._btnToggleKey);
    this._refreshBtnToggleKey();

    return de;
};

p.isOwnedDomElement = function (de) {

    return this._selectedElements.indexOf(de) !== -1;
};

p.selectElements = function () {

    var list = [];

    this._selectors.forEach(function (selector) {

        var items = am.deRoot.querySelectorAll(selector);
        items = Array.prototype.slice.call(items);
        list = list.concat(items);
    });

    this._selectedElements = list;
};

module.exports = CssSequence;




