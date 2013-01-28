const St = imports.gi.St;
const Lang = imports.lang;
const Cinnamon = imports.gi.Cinnamon;
const Clutter = imports.gi.Clutter;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const GnomeSession = imports.misc.gnomeSession;
const ScreenSaver = imports.misc.screenSaver;
const DND = imports.ui.dnd;
const Meta = imports.gi.Meta;

const AppletDir = imports.ui.appletManager.applets['win7Menu@physics'];
const MainApplet = AppletDir.applet;
const Items = AppletDir.items;

function RightButtonsBox(appsMenuButton, menu) {
    this._init(appsMenuButton, menu);
}

RightButtonsBox.prototype = {
    _init: function (appsMenuButton, menu) {
        this.appsMenuButton = appsMenuButton;
        this.actor = new St.BoxLayout();
        this.itemsBox = new St.BoxLayout({
            vertical: true
        });
        this.shutDownItemsBox = new St.BoxLayout({
            vertical: true
        });
        this.shutdownBox = new St.BoxLayout({
            vertical: false
        });
        this.actor._delegate = this;
        this.menu = menu;
        this.addItems();
        this._container = new Cinnamon.GenericContainer();
        this.actor.add(this._container);
        this._container.connect('get-preferred-height', Lang.bind(this, this._getPreferredHeight));
        this._container.connect('get-preferred-width', Lang.bind(this, this._getPreferredWidth));
        this._container.connect('allocate', Lang.bind(this, this._allocate));
        this._container.add_actor(this.itemsBox);
        this._container.add_actor(this.shutDownItemsBox);
    },

    addItems: function () {
        this.hoverIcon = new Items.HoverIcon();
        this.home = new Items.TextBoxItem(_("Home"), "folder-home", "Util.spawnCommandLine('nemo')", this.menu, this.hoverIcon, false);
        this.documents = new Items.TextBoxItem(_("Documents"), "folder-documents", "Util.spawnCommandLine('nemo Documents')", this.menu, this.hoverIcon, false);
        this.pictures = new Items.TextBoxItem(_("Pictures"), "folder-pictures", "Util.spawnCommandLine('nemo Pictures')", this.menu, this.hoverIcon, false);
        this.music = new Items.TextBoxItem(_("Music"), "folder-music", "Util.spawnCommandLine('nemo Music')", this.menu, this.hoverIcon, false);
        this.videos = new Items.TextBoxItem(_("Videos"), "folder-videos", "Util.spawnCommandLine('nemo Videos')", this.menu, this.hoverIcon, false);
        this.computer = new Items.TextBoxItem(_("Computer"), "computer", "Util.spawnCommandLine('nemo computer:///')", this.menu, this.hoverIcon, false);
        this.packageItem = new Items.TextBoxItem(_("Package Manager"), "synaptic", "Util.spawnCommandLine('gksu synaptic')", this.menu, this.hoverIcon, false);
        this.control = new Items.TextBoxItem(_("Control Center"), "gnome-control-center", "Util.spawnCommandLine('gnome-control-center')", this.menu, this.hoverIcon, false);
        this.terminal = new Items.TextBoxItem(_("Terminal"), "terminal", "Util.spawnCommandLine('gnome-terminal')", this.menu, this.hoverIcon, false);
        this.help = new Items.TextBoxItem(_("Help"), "help", "Util.spawnCommandLine('yelp')", this.menu, this.hoverIcon, false);
        this.shutdown = new Items.TextBoxItem(_("Shutdown"), "system-shutdown", "Session.ShutdownRemote()", this.menu, this.hoverIcon, false);
        this.shutdownMenu = new Items.ShutdownMenu(this.menu, this.hoverIcon);

        this.shutdownBox.add_actor(this.shutdown.actor);
        this.shutdownBox.add_actor(this.shutdownMenu.actor);

        this.itemsBox.add_actor(this.hoverIcon.icon);
        this.itemsBox.add_actor(this.home.actor);
        this.itemsBox.add_actor(this.pictures.actor);
        this.itemsBox.add_actor(this.music.actor);
        this.itemsBox.add_actor(this.videos.actor);
        this.itemsBox.add_actor(this.documents.actor);
        this.itemsBox.add_actor(new PopupMenu.PopupSeparatorMenuItem().actor);
        this.itemsBox.add_actor(this.computer.actor);
        this.itemsBox.add_actor(this.control.actor);
        this.itemsBox.add_actor(new PopupMenu.PopupSeparatorMenuItem().actor);
        this.itemsBox.add_actor(this.packageItem.actor);
        this.itemsBox.add_actor(this.terminal.actor);
        this.itemsBox.add_actor(this.help.actor);
        this.shutDownItemsBox.add_actor(this.shutdownBox);
        this.shutDownItemsBox.add_actor(this.shutdownMenu.menu.actor);
    }, 

    _getPreferredHeight: function (actor, forWidth, alloc) {
        let[minSize, naturalSize] = this.itemsBox.get_preferred_height(forWidth);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _getPreferredWidth: function (actor, forHeight, alloc) {
        let[minSize, naturalSize] = this.itemsBox.get_preferred_width(forHeight);
        alloc.min_size = minSize;
        alloc.natural_size = naturalSize;
    },

    _allocate: function (actor, box, flags) {
        let childBox = new Clutter.ActorBox();

        let[minWidth, minHeight, naturalWidth, naturalHeight] = this.itemsBox.get_preferred_size();

        childBox.y1 = 0;
        childBox.y2 = childBox.y1 + naturalHeight;
        childBox.x1 = 0;
        childBox.x2 = childBox.x1 + naturalWidth;
        this.itemsBox.allocate(childBox, flags);

        let menuHeight = this.menu.actor.get_height();

        [minWidth, minHeight, naturalWidth, naturalHeight] = this.shutDownItemsBox.get_preferred_size();

        childBox.y1 = menuHeight - 100;
        childBox.y2 = childBox.y1;
        childBox.x1 = 0;
        childBox.x2 = childBox.x1 + naturalWidth;
        this.shutDownItemsBox.allocate(childBox, flags);
    }
}

function FavoritesBox() {
    this._init();
}

FavoritesBox.prototype = {
    _init: function () {
        this.actor = new St.BoxLayout({
            vertical: true
        });
        this.actor._delegate = this;

        this._dragPlaceholder = null;
        this._dragPlaceholderPos = -1;
        this._animatingPlaceholdersCount = 0;
    },

    _clearDragPlaceholder: function () {
        if (this._dragPlaceholder) {
            this._dragPlaceholder.animateOutAndDestroy();
            this._dragPlaceholder = null;
            this._dragPlaceholderPos = -1;
        }
    },

    handleDragOver: function (source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed() || (!(source instanceof Items.FavoritesButton) && app.get_id() in AppFavorites.getAppFavorites().getFavoriteMap())) return DND.DragMotionResult.NO_DROP;

        let favorites = AppFavorites.getAppFavorites().getFavorites();
        let numFavorites = favorites.length;

        let favPos = favorites.indexOf(app);

        let children = this.actor.get_children();
        let numChildren = children.length;
        let boxHeight = this.actor.height;

        // Keep the placeholder out of the index calculation; assuming that
        // the remove target has the same size as "normal" items, we don't
        // need to do the same adjustment there.
        if (this._dragPlaceholder) {
            boxHeight -= this._dragPlaceholder.actor.height;
            numChildren--;
        }

        let pos = Math.round(y * numFavorites / boxHeight);

        if (pos != this._dragPlaceholderPos && pos <= numFavorites) {
            if (this._animatingPlaceholdersCount > 0) {
                let appChildren = children.filter(function (actor) {
                    return (actor._delegate instanceof Items.FavoritesButton);
                });
                this._dragPlaceholderPos = children.indexOf(appChildren[pos]);
            } else {
                this._dragPlaceholderPos = pos;
            }

            // Don't allow positioning before or after self
            if (favPos != -1 && (pos == favPos || pos == favPos + 1)) {
                if (this._dragPlaceholder) {
                    this._dragPlaceholder.animateOutAndDestroy();
                    this._animatingPlaceholdersCount++;
                    this._dragPlaceholder.actor.connect('destroy', Lang.bind(this, function () {
                        this._animatingPlaceholdersCount--;
                    }));
                }
                this._dragPlaceholder = null;

                return DND.DragMotionResult.CONTINUE;
            }

            // If the placeholder already exists, we just move
            // it, but if we are adding it, expand its size in
            // an animation
            let fadeIn;
            if (this._dragPlaceholder) {
                this._dragPlaceholder.actor.destroy();
                fadeIn = false;
            } else {
                fadeIn = true;
            }

            this._dragPlaceholder = new DND.GenericDragPlaceholderItem();
            this._dragPlaceholder.child.set_width(source.actor.height);
            this._dragPlaceholder.child.set_height(source.actor.height);
            this.actor.insert_actor(this._dragPlaceholder.actor, this._dragPlaceholderPos);
            if (fadeIn) this._dragPlaceholder.animateIn();
        }

        let srcIsFavorite = (favPos != -1);

        if (srcIsFavorite) return DND.DragMotionResult.MOVE_DROP;

        return DND.DragMotionResult.COPY_DROP;
    },

    // Draggable target interface
    acceptDrop: function (source, actor, x, y, time) {
        let app = source.app;

        // Don't allow favoriting of transient apps
        if (app == null || app.is_window_backed()) {
            return false;
        }

        let id = app.get_id();

        let favorites = AppFavorites.getAppFavorites().getFavoriteMap();

        let srcIsFavorite = (id in favorites);

        let favPos = 0;
        let children = this.actor.get_children();
        for (let i = 0; i < this._dragPlaceholderPos; i++) {
            if (this._dragPlaceholder && children[i] == this._dragPlaceholder.actor) continue;

            if (!(children[i]._delegate instanceof Items.FavoritesButton)) continue;

            let childId = children[i]._delegate.app.get_id();
            if (childId == id) continue;
            if (childId in favorites) favPos++;
        }

        Meta.later_add(Meta.LaterType.BEFORE_REDRAW, Lang.bind(this, function () {
            let appFavorites = AppFavorites.getAppFavorites();
            if (srcIsFavorite) appFavorites.moveFavoriteToPos(id, favPos);
            else appFavorites.addFavoriteAtPos(id, favPos);
            return false;
        }));

        return true;
    }
}
