'use strict';

const silkedit = require('silkedit');

const MODE = {
	CMD: Symbol(),
	INSERT: Symbol(),
	CMDLINE: Symbol()
}

const MoveOperation = {
  FirstNonBlankChar: Symbol(),        // ^
  LastChar: Symbol(),                 // $
  NextLine: Symbol(),                 // Enter, +
  PrevLine: Symbol(),                 // -
}

var isEnabled = false
var mode = MODE.CMD
var repeatCount = 0

const keyEventFilter = (event) => {
  if (event.type() !== silkedit.Event.Type.KeyPress || !(silkedit.App.focusWidget() instanceof silkedit.TextEditView)) {
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
			
			if (key === silkedit.Key.Key_Return || key === silkedit.Key.Key_Enter) {
			  moveCursor(MoveOperation.NextLine);
			} else {
        silkedit.KeymapManager.dispatch(event);
			}
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
	
  silkedit.Condition.add("vim.mode", modeCond);

	mode = MODE.CMD
	onModeChanged(mode)
	repeatCount = 0
	isEnabled = true
}

function disable() {
	silkedit.KeymapManager.removeKeyEventFilter(keyEventFilter);
  silkedit.CommandManager.removeCommandEventFilter(commandEventFilter);
  silkedit.App.removeListener('focusChanged', focusChangedListener);
  silkedit.Condition.remove("vim.mode");
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
		const view = silkedit.App.activeTextEditView();
		if (newMode == MODE.CMD && view != null) {
			moveCursor(silkedit.TextCursor.MoveOperation.Left, 1);
		}

		mode = newMode
		onModeChanged(newMode)
	}
}

function isTabOrSpace(ch) {
  return ch === '\t' || ch === ' ';
}


function firstNonBlankCharPos(text) {
  let ix = 0;
  while (ix < text.length && isTabOrSpace(text.charAt(ix))) {
    ++ix;
  }
  return ix;
}

function moveToFirstNonBlankChar(cur) {
  const block = cur.block();
  const blockPos = block.position();
  const blockText = block.text();
  if (blockText.length > 0) {
    cur.setPosition(blockPos + firstNonBlankCharPos(blockText));
  }
}


function moveCursor(operation, repeat) {
  const editView = silkedit.App.activeTextEditView();
  if (editView != null) {
    repeat = typeof repeat === 'number' ? repeat : 1;
    const cursor = editView.textCursor();
    const pos = cursor.position();
    const block = cursor.block();
    const blockPos = block.position();
    const blockText = block.text();

    switch (operation) {
      case silkedit.TextCursor.MoveOperation.Left:
        repeat = Math.min(repeat, pos - blockPos);
        cursor.movePosition(operation, silkedit.TextCursor.MoveMode.MoveAnchor, repeat);
        break;
      case silkedit.TextCursor.MoveOperation.Right:
        if (blockText.length === 0)
          return;  // new line or EOF only
        let endpos = blockPos + blockText.length;
        // If the cursor is block mode, don't allow it to move at EOL
        if (!editView.isThinCursor()) {
          endpos -= 1;
        }
        if (pos >= endpos)
          return;
        repeat = Math.min(repeat, endpos - pos);
        cursor.movePosition(operation, silkedit.TextCursor.MoveMode.MoveAnchor, repeat);
        break;
      case MoveOperation.FirstNonBlankChar:
        cursor.setPosition(blockPos + firstNonBlankCharPos(blockText));
        break;
      case MoveOperation.LastChar:
        let ix = blockText.length;
        if (ix != 0)  --ix;
        cursor.setPosition(blockPos + ix);
        break;
      case MoveOperation.NextLine:
        cursor.movePosition(silkedit.TextCursor.MoveOperation.NextBlock, silkedit.TextCursor.MoveMode.MoveAnchor, repeat);
        moveToFirstNonBlankChar(cursor);
        break;
      case MoveOperation.PrevLine:
        cursor.movePosition(silkedit.TextCursor.MoveOperation.PreviousBlock, silkedit.TextCursor.MoveMode.MoveAnchor, repeat);
        moveToFirstNonBlankChar(cursor);
        break;
      default:
        break;
    }

    editView.setTextCursor(cursor);
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
		},
		"insert_mode": () => {
			if (!isEnabled) return
			setMode(MODE.INSERT)
		},
		"command_mode": () => {
			if (!isEnabled) return
			setMode(MODE.CMD)
		},
		"commandline_mode": () => {
			if (!isEnabled) return
			setMode(MODE.CMDLINE)
		},
		"move_cursor_left": (args) => {
		  const repeat = 'repeat' in args ? Number.parseInt(args.repeat) : 1;
		  moveCursor(silkedit.TextCursor.MoveOperation.Left, repeat);
		},
		"move_cursor_right": (args) => {
		  const repeat = 'repeat' in args ? Number.parseInt(args.repeat) : 1;
		  moveCursor(silkedit.TextCursor.MoveOperation.Right, repeat);
		},
    "move_cursor_first_non_blank_char": (args) => {
		  moveCursor(MoveOperation.FirstNonBlankChar);
		},
		"move_cursor_last_char": (args) => {
		  moveCursor(MoveOperation.LastChar);
		},
		"move_cursor_next_line": (args) => {
		  moveCursor(MoveOperation.NextLine);
		},
		"move_cursor_prev_line": (args) => {
		  moveCursor(MoveOperation.PrevLine);
		}
	}
}
