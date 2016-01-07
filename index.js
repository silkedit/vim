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

const keyPressHandler = (event) => {
	console.log('keyPressHandler')
	switch (mode) {
		case MODE.CMD:
			if (event.key) {
				const ch = event.key.charCodeAt(0)
				if ((ch == "0".charCodeAt(0) && repeatCount != 0) || (ch >= "1".charCodeAt(0) && ch <= "9".charCodeAt(0))) {
					repeatCount = repeatCount * 10 + (ch - "0".charCodeAt(0))
					console.log('repeatCount: %d', repeatCount)
					return true
				}

			}
			silkedit.KeymapManager.dispatch(event);
			return true
		case MODE.CMDLINE:
			if (event.key == "Escape") {
				setMode(MODE.CMD)
				return true
			}
			break
	}

	return false
}

const runCommandHandler = (event) => {
	if (repeatCount > 0) {
		event.args.repeat = repeatCount.toString()
		repeatCount = 0
	}
	return false
}

const focusChangedHandler = (event) => {
	if (event.type === 'TextEditView') {
		mode = MODE.CMD
		updateCursor()
	}
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

function enable() {
	silkedit.installEventFilter('keypress', keyPressHandler)
	silkedit.installEventFilter('runCommand', runCommandHandler)
	silkedit.installEventFilter('focusChanged', focusChangedHandler)
	silkedit.registerCondition("vim.mode", (operator, value) => {
		console.log('checking mode condition')
		return isEnabled && silkedit.conditionUtils.isSatisfied(toModeText(mode), operator, value)
	})
	mode = MODE.CMD
	onModeChanged(mode)
	repeatCount = 0
	isEnabled = true
}

function disable() {
  silkedit.removeEventFilter('keypress', keyPressHandler)
  silkedit.removeEventFilter('runCommand', runCommandHandler)
  silkedit.removeEventFilter('focusChanged', focusChangedHandler)
  silkedit.unregisterCondition("vim.mode")
  const view = silkedit.API.activeTextEditView();
  if (view != null) {
    view.setThinCursor(true)
  }

  silkedit.API.windows().forEach(w => w.statusBar().clearMessage())

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

	let win = silkedit.API.activeWindow()
	if (win != null) {
		win.statusBar().showMessage(text)
	}

	updateCursor()
}

function updateCursor() {
	const view = silkedit.API.activeTextEditView();
	if (view != null) {
		const isThin = mode !== MODE.CMD
		view.setThinCursor(isThin)
	}
}

function setMode(newMode) {
	if (mode !== newMode) {
		const view = silkedit.API.activeTextEditView()
		if (newMode == MODE.CMD && view != null) {
			view.moveCursor('left')
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
