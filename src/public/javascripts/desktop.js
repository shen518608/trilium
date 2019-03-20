import addLinkDialog from './dialogs/add_link.js';
import jumpToNoteDialog from './dialogs/jump_to_note.js';
import attributesDialog from './dialogs/attributes.js';
import noteRevisionsDialog from './dialogs/note_revisions.js';
import noteSourceDialog from './dialogs/note_source.js';
import recentChangesDialog from './dialogs/recent_changes.js';
import optionsDialog from './dialogs/options.js';
import sqlConsoleDialog from './dialogs/sql_console.js';
import markdownImportDialog from './dialogs/markdown_import.js';
import exportDialog from './dialogs/export.js';
import importDialog from './dialogs/import.js';

import cloning from './services/cloning.js';
import contextMenu from './services/tree_context_menu.js';
import dragAndDropSetup from './services/drag_and_drop.js';
import link from './services/link.js';
import messagingService from './services/messaging.js';
import noteDetailService from './services/note_detail.js';
import noteType from './services/note_type.js';
import protectedSessionService from './services/protected_session.js';
import protectedSessionHolder from './services/protected_session_holder.js';
import searchNotesService from './services/search_notes.js';
import FrontendScriptApi from './services/frontend_script_api.js';
import ScriptContext from './services/script_context.js';
import sync from './services/sync.js';
import treeService from './services/tree.js';
import treeChanges from './services/branches.js';
import treeUtils from './services/tree_utils.js';
import utils from './services/utils.js';
import server from './services/server.js';
import entrypoints from './services/entrypoints.js';
import noteTooltipService from './services/note_tooltip.js';
import bundle from "./services/bundle.js";
import treeCache from "./services/tree_cache.js";
import libraryLoader from "./services/library_loader.js";
import hoistedNoteService from './services/hoisted_note.js';
import noteTypeService from './services/note_type.js';
import linkService from './services/link.js';
import noteAutocompleteService from './services/note_autocomplete.js';
import macInit from './services/mac_init.js';
import cssLoader from './services/css_loader.js';

// required for CKEditor image upload plugin
window.glob.getActiveNode = treeService.getActiveNode;
window.glob.getHeaders = server.getHeaders;
window.glob.showAddLinkDialog = addLinkDialog.showDialog;
// this is required by CKEditor when uploading images
window.glob.noteChanged = noteDetailService.noteChanged;
window.glob.refreshTree = treeService.reload;

// required for ESLint plugin
window.glob.getActiveNote = noteDetailService.getActiveNote;
window.glob.requireLibrary = libraryLoader.requireLibrary;
window.glob.ESLINT = libraryLoader.ESLINT;

protectedSessionHolder.setProtectedSessionId(null);

window.onerror = function (msg, url, lineNo, columnNo, error) {
    const string = msg.toLowerCase();

    let message = "Uncaught error: ";

    if (string.includes("Cannot read property 'defaultView' of undefined")) {
        // ignore this specific error which is very common but we don't know where it comes from
        // and it seems to be harmless
        return true;
    }
    else if (string.includes("script error")) {
        message += 'No details available';
    }
    else {
        message += [
            'Message: ' + msg,
            'URL: ' + url,
            'Line: ' + lineNo,
            'Column: ' + columnNo,
            'Error object: ' + JSON.stringify(error)
        ].join(' - ');
    }

    messagingService.logError(message);

    return false;
};

for (const appCssNoteId of window.appCssNoteIds) {
    cssLoader.requireCss(`/api/notes/download/${appCssNoteId}`);
}

const wikiBaseUrl = "https://github.com/zadam/trilium/wiki/";

$(document).on("click", "button[data-help-page]", e => {
    const $button = $(e.target);

    window.open(wikiBaseUrl + $button.attr("data-help-page"), '_blank');
});

$("#logout-button").toggle(!utils.isElectron());

$("#logout-button").click(() => {
    const $logoutForm = $('<form action="logout" method="POST">');

    $("body").append($logoutForm);
    $logoutForm.submit();
});

$("#tree").on("click", ".unhoist-button", hoistedNoteService.unhoist);

$("body").on("click", "a.external", function () {
    window.open($(this).attr("href"), '_blank');
});

if (utils.isElectron()) {
    require('electron').ipcRenderer.on('create-day-sub-note', async function(event, parentNoteId) {
        // this might occur when day note had to be created
        if (!await treeCache.getNote(parentNoteId)) {
            await treeService.reload();
        }

        await treeService.activateNote(parentNoteId);

        setTimeout(async () => {
            const parentNode = treeService.getActiveNode();

            const {note} = await treeService.createNote(parentNode, parentNode.data.noteId, 'into', "text", parentNode.data.isProtected);

            await treeService.activateNote(note.noteId);

        }, 500);
    });
}

$("#export-note-button").click(function () {
    if ($(this).hasClass("disabled")) {
        return;
    }

    exportDialog.showDialog('single');
});

$('[data-toggle="tooltip"]').tooltip({
    html: true
});

$("#import-files-button").click(importDialog.showDialog);

macInit.init();

searchNotesService.init(); // should be in front of treeService since that one manipulates address bar hash

treeService.showTree();

entrypoints.registerEntrypoints();

noteTooltipService.setupGlobalTooltip();

bundle.executeStartupBundles();

noteTypeService.init();

linkService.init();

noteAutocompleteService.init();