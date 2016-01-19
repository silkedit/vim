'use strict';

const silkedit = require('silkedit');

const MODE = {
	CMD: Symbol(),
	INSERT: Symbol(),
	CMDLINE: Symbol()
}

var isEnabled = false
var mode = MODE.CMD
var repeatCount = 0

const keyEventFilter = (event) => {
  if (event.type() !== silkedit.Event.Type.KeyPress) {
    return false;
  }

	switch (mode) {
		case MODE.CMD:
  		const key = event.key();
  		if ((key == silkedit.Key.Key_0 && repeatCount != 0) || (key >= silkedit.Key.Key_1 && key <= silkedit.Key.Key_9)) {
				repeatCount = repeatCount * 10 + (key - silkedit.Key.Key_0);
				console.log('repeatCount: %d', repeatCount);
				return true;
			}
			silkedit.KeymapManager.dispatch(event);
			return true;
		case MODE.CMDLINE:
			if (event.key == silkedit.Key.Key_Escape) {
				setMode(MODE.CMD)
				return true
			}
			break
	}

	return false;
}

function toModeText(mode) {
	switch (mode) {
		case MODE.CMD:
			return "normal"
		case MODE.INSERT:
			return "insert"
		case MODE.CMDLINE:
			return "commandline"
		default:
			console.warn('invalid mode: %s', mode)
			return null
	}
}

function focusChangedListener(old, now) {
 	if (now instanceof silkedit.TextEditView) {
 		mode = MODE.CMD;
 		updateCursor();
  }
};

function commandEventFilter(event) {
  if (repeatCount > 0) {
    event.args.repeat = repeatCount.toString();
    repeatCount = 0
  }
	return false;
}

function enable() {
	silkedit.KeymapManager.addKeyEventFilter(keyEventFilter);
  silkedit.CommandManager.addCommandEventFilter(commandEventFilter);

	silkedit.App.on('focusChanged', focusChangedListener);
	
	const modeCond = {
	  isSatisfied: (operator, operand) => {
  	  return isEnabled && silkedit.Condition.check(toModeText(mode), operator, operand);
  	}
	}
	
  silkedit.ConditionManager.add("vim.mode", modeCond);

	mode = MODE.CMD
	onModeChanged(mode)
	repeatCount = 0
	isEnabled = true
}

function disable() {
	silkedit.KeymapManager.removeKeyEventFilter(keyEventFilter);
  silkedit.CommandManager.removeCommandEventFilter(commandEventFilter);
  silkedit.App.removeListener('focusChanged', focusChangedListener);
  silkedit.ConditionManager.remove("vim.mode");
  const view = silkedit.App.activeTextEditView();
  if (view != null) {
    view.setThinCursor(true)
  }

  silkedit.Window.windows().forEach(w => w.statusBar().clearMessage())

  isEnabled = false
}

function onModeChanged(newMode) {
	let text;
	switch (mode) {
		case MODE.CMD:
			text = "CMD"
			break
		case MODE.INSERT:
			text = "INSERT"
			break
		default:
			return
	}

	let win = silkedit.App.activeWindow()
	if (win != null) {
		win.statusBar().showMessage(text)
	}

	updateCursor()
}

function updateCursor() {
	const view = silkedit.App.activeTextEditView();
	if (view != null) {
		const isThin = mode !== MODE.CMD
		view.setThinCursor(isThin)
	}
}

function setMode(newMode) {
	if (mode !== newMode) {
		const view = silkedit.App.activeTextEditView()
		if (newMode == MODE.CMD && view != null) {
			view.moveCursor('left');
		}

		mode = newMode
		onModeChanged(newMode)
	}
}

module.exports = {
	activate: () => {
		if (silkedit.Config.get('vim.enable_on_startup')) {
			enable()
		}
	}

  ,deactivate: () => {
    disable()
  }

	,commands: {
		"toggle_vim_emulation": () => {
			if (isEnabled) {
				disable()
			} else {
				enable()
			}
		}
		,"insert_mode": () => {
			if (!isEnabled) return
			setMode(MODE.INSERT)
		}
		,"command_mode": () => {
			if (!isEnabled) return
			setMode(MODE.CMD)
		}
		,"commandline_mode": () => {
			if (!isEnabled) return
			setMode(MODE.CMDLINE)
		}
	}
}
