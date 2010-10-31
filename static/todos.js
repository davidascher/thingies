// inspired by the example from [Jérôme Gravel-Niquet](http://jgn.me/).

$(function(){

  window.Todo = Backbone.Model.extend({

    // If you don't provide a todo, one will be provided for you.
    EMPTY: "empty todo...",

    // Ensure that each todo created has `content`.
    initialize: function() {
      if (!this.get("content")) {
        this.set({"content": this.EMPTY});
      }
    },

    // Toggle the `done` state of this todo item.
    toggleAndDeselect: function() {
      this.save({done: !this.get("done"), selected: false});
    },

    toggleSelect: function() {
      this.save({selected: !this.get("selected")});
    },

    // Remove this Todo from *localStorage*, deleting its view.
    clear: function() {
      this.destroy();
      $(this.view.el).remove();
    },
    
    error: function(a) {
      console.log("GOT ERROR", a);
    }

  });

  // Todo Collection
  // ---------------

  window.TodoList = Backbone.Collection.extend({

    // Reference to this collection's model.
    model: Todo,

    // Save all of the todo items under the `"todos"` namespace.
    //localStorage: new Store("todos"),
    url: "/todos",

    // Filter down the list of all todo items that are finished.
    done: function() {
      return this.filter(function(todo){ return todo.get('done'); });
    },

    selected: function() {
      return this.filter(function(todo){ return todo.get('selected'); });
    },

    // Filter down the list to only todo items that are still not finished.
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    // We keep the Todos in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1 || 1;
    },

    // Todos are sorted by their original insertion order.
    comparator: function(todo) {
      return todo.get('order');
    }

  });

  // The DOM element for a todo item...
  window.TodoView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "div",

    // Cache the template function for a single item.
    template: _.template($('#item-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .check"              : "toggleDone",
      "click .cell"               : "toggleSelect",
      "dblclick div.todo-content" : "edit",
      "click span.todo-destroy"   : "clear",
      "keypress .todo-input"      : "updateOnEnter",
    },

    // The TodoView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a **Todo** and a **TodoView** in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      _.bindAll(this, 'render');
      this.model.bind('change', this.render);
      this.model.view = this;
      $("#new-todo").focus();
      $("#new-todo").select();
    },

    // Re-render the contents of the todo item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      $(this.el).addClass('box');
      $(this.el).find(".cell").hover(function(event) {
        obj = $(this);
        obj.toggleClass('hover');
      });
      this.setContent();
      return this;
    },

    // To avoid XSS (not that it would be harmful in this particular app),
    // we use `jQuery.text` to set the contents of the todo item.
    setContent: function() {
      var content = this.model.get('content');
      this.$('.todo-content').html(window.markdown.toHTML(content));
      this.$('.todo-input').val(content);
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
      $(this.el).toggleClass('big');
      App.updateButtons();
    },
    toggleSelect: function(e) {
      // detect if it's a double-click, and don't do anything (to let the
      // double click handler deal w/ it.)
      if (e.detail == 2) return;
      this.model.toggleSelect();
      App.updateButtons();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      try {
        $(".editing").removeClass('editing');
        $(this.el).addClass("editing");
        //$(this.el).find(".todo-content").text(this.model.get('content'));
        $(".editing textarea").select();
        $(".editing textarea").focus();
      } catch (e) {
        console.log(e);
      }
    },

    // If you hit enter, submit the changes to the todo item's `content`.
    updateOnEnter: function(e) {
      if (e.keyCode != 13 || ! e.ctrlKey) return;
      var updateTags = _.bind(this.updateTags, this);
      this.model.save({content: this.$(".todo-input").val(),
                      order: 1,}, {success: updateTags});
      $(this.el).removeClass("editing");
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.clear();
    },
    
    error: function(a) {
    }

  });

  window.Tag = Backbone.Model.extend({

    // Ensure that each Tag created has `content`.
    initialize: function() {
      if (!this.get("name")) {
        this.set({"name": 'untitled'});
      }
    },
    clear: function() {
      this.destroy();
      $(this.view.el).remove();
    },
    error: function(a) {
      console.log("GOT ERROR", a);
    }
  });


  // Todo Collection
  // ---------------

  window.TagList = Backbone.Collection.extend({
    model: Tag,
    url: "/tags",
    comparator: function(Tag) {
      return Tag.get('name');
    }
  });

  // The DOM element for a Tag item...
  window.TagView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "div",

    // Cache the template function for a single item.
    template: _.template($('#tag-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .filter"              : "toggleFilter",
      "click .new"                 : "newWithTag",
    },

    // The TagView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a **Tag** and a **TagView** in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      _.bindAll(this, 'render');
      this.model.bind('change', this.render);
      this.model.view = this;
    },

    // Re-render the contents of the Tag item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setContent();
      return this;
    },

    // To avoid XSS (not that it would be harmful in this particular app),
    // we use `jQuery.text` to set the contents of the Tag item.
    setContent: function() {
      var content = this.model.get('name');
      this.$('.tagname').text(content);
    },

    toggleFilter: function() {
      var checked = $(this.el).find('.filter').attr('checked');
      var curFilter = $("#filter")[0].value;
      var words = curFilter.match(/\w+|"[^"]+"/g) || []; // split words
      var newFilter = this.model.attributes['name'];
      if (checked && ! _.contains(newFilter, words)){
        words.push(newFilter);
      } else if (_.contains(words, newFilter)){
        words = _.without(words, newFilter);
        $("#filter")[0].value = words.join(' ');
        App.updateFilter();
      }
      $("#filter")[0].value = words.join(' ');
      App.updateFilter();
    },

    newWithTag: function(filter) {
      App.showNewTodoDialog(this.model.attributes['name']+ ': ');
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.clear();
    },
    
    error: function(a) {
    }

  });


  // Create our global collection of **Todos**.
  window.Todos = new TodoList;
  window.Tags = new TagList;

  // The Application
  // ---------------

  // Our overall **AppView** is the top-level piece of UI.
  window.AppView = Backbone.View.extend({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#todoapp"),

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "keypress #new-todo":  "createOnEnter",
      "click .todo-clear a": "clearCompleted",
      "keyup #filter": "updateFilter"
    },

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved in *localStorage*.
    initialize: function() {
      _.bindAll(this, 'addOne', 'addAll', 'render');

      this.input    = this.$("#new-todo");
      this.tags = [];
      this.words = {};

      Todos.bind('add',     this.addOne);
      Todos.bind('refresh', this.addAll);
      Todos.bind('all',     this.render);
      Todos.fetch({success: function() {window.App.updateButtons()}});

      Tags.bind('add',     this.addOneTag);
      Tags.bind('refresh', this.addAllTags);
      Tags.fetch();


      // find out what the server needs to tell us (user name, etc.)
      $.ajax({
        url       : '/config',
        type      : 'get',
        data      : '',
        dataType  : 'json',
        success   : function(a) { if (a.username) { $("#username").text(a.username);} },
        error     : function(a) { console.log("ERROR", a); }
      });

      window.tags = this.tags;
      // this autocomplete is too iffy.  In particular:
      //   - the box shwos up at the bottom of the textbox, not under the cursor
      //   - it will case-correct if the only match is something w/ a case difference.
      //this.autocomplete = $("#new-todo").autocomplete(window.tags, {
      //  multiple: true,
      //  autoFill: false,
      //  multipleSeparator: " ",
      //  autoFill: true,
      //});

      this.masonry =  null


      // disabling sortable because interacts badly w/ selection (move and things get unselected)
      //$( ".sortable" ).sortable({
      //  handle: '.handle',
      //  revert: true
      //});
      $( ".cell" ).disableSelection();
      $("#bigN").click(_.bind(this.showNewTodoDialog, this))
      
      // XXX Move this to backbone model
      $("html").keydown(_.bind(this.keydown, this));
      $("html").keypress(_.bind(this.keypress, this));
    },

    showNewTodoDialog: function(prefill) {
      try {
        if (this.onEscape) return;
        this.onEscape = _.bind(this.hideNewTodoDialog, this);
        newTodo = $("#new-todo-box");
        newTodo.removeClass('hidden');
        $("#new-todo")[0].focus();
        $("#new-todo")[0].select();
        if (prefill && typeof(prefill) == "string") {
          $("#new-todo")[0].textContent = prefill;
          $("#new-todo")[0].selectionStart = $("#new-todo")[0].selectionEnd;
        }
      } catch (e) {
        console.log(e);
      }
    },

    hideNewTodoDialog: function() {
      $("#new-todo-box").addClass('hidden');
      $("#filter").focus();
    },

    updateButtons: function(e) {
      var hasSelection = (Todos.selected().length > 0);
      if (hasSelection) {
        $(".need-selection").removeClass('disabled');
      } else {
        $(".need-selection").addClass('disabled');
      }
      var hasDone = (Todos.done().length > 0);
      if (hasDone) {
        $(".need-done").removeClass('disabled');
      } else {
        $(".need-done").addClass('disabled');
      }
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = Todos.done().length;
      this.$('#todo-stats').html(this.statsTemplate({
        total:      Todos.length,
        done:       Todos.done().length,
        remaining:  Todos.remaining().length
      }));
    },
    
    // Add a single todo item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(todo) {
      var view = new TodoView({model: todo});
      
      newEl = view.render().el;
      el = this.$("#todo-list").append(newEl);
      el.view = view;
      if (this.masonry) {
        // only works w/ appending, which is a UX problem IMO
        $("#todo-list").masonry({appendedContent: $(newEl)});
      }
    },
    
    // Add all items in the **Todos** collection at once.
    addAll: function() {
      dudes = Todos.each(this.addOne);
      jdudes = $(dudes);
      if (! this.masonry) {
        this.masonry_opts = {columnWidth: 120, itemSelector: '.box:not(.invis)'}
        this.masonry = true;
        $('#todo-list').masonry(this.masonry_opts);
      }
      this.updateTags();
    },

    addOneTag: function(tag) {
      try {
        var view = new TagView({model: tag});
        el = this.$("#tags").prepend(view.render().el);
        el.view = view;
      } catch (e) {
        console.log(e);
      }
      
    },

    addAllTags: function() {
      Tags.each(window.App.addOneTag); // WHY is this not the app?
    },


    updateTags: function() {
      appwords = this.words;
      _.each(Todos.models, function(item) {
        content = item.view.model.attributes.content;
        if (content) {
          var words = content.match(/\w+|"[^"]+"/g); // split words
          _.each(words, function (word) {
            if (word in words) {
              appwords[word]++;
            } else {
              appwords[word] = 1;
            }
          });
        }
      });
      tags = _.filter(_.keys(appwords), function(word) {
        return (appwords[word] > 0)
      });
      //this.autocomplete.setOptions({data: tags});
    },

    // Generate the attributes for a new Todo item.
    newAttributes: function() {
      return {
        content: this.input.val(),
        order:   Todos.nextOrder(),
        done:    false,
        selected:false,
        tags: "[]",
      };
    },

    // If you hit return in the main input field, create new **Todo** model,
    // persisting it to *localStorage*.
    createOnEnter: function(e) {
      if (e.keyCode != 13) return;
      var updateTags = _.bind(this.updateTags, this);
      todo = Todos.create(this.newAttributes(), {success: updateTags});
      this.input.val('');
      this.hideNewTodoDialog();
      this.onEscape = null;
      //$('#todo-list').masonry({
      //  columnWidth: 240,
      //  itemSelector: '.box' 
      //});
    },

    keypress: function(e) {
      if (e.charCode == 110 && !this.onEscape) { // 'n'
        e.stopPropagation();
        e.preventDefault();
        this.showNewTodoDialog();
      }
    },
    
    keydown: function(e) {
      if (e.which == 32) { // Space bar toggles Done state on all selected todos
        if (! $(e.target).find('#todos').length) {
          return;
        }
        _.each(Todos.selected(), function(todo){ todo.toggleAndDeselect(); });
        e.preventDefault();
        e.stopPropagation();
      }
      else if (e.which == 27) { // Escape clears selection
        e.preventDefault();
        e.stopPropagation();
        if (this.onEscape) {
          this.onEscape()
          this.onEscape = null;
        } else {
          _.each(Todos.selected(), function(todo){ todo.toggleSelect(); });
        }
      }
    },
    
    updateFilter: function(e) {
      var filterNode = $("#filter");
      var filter = filterNode.val().trim();
      var speed = 300;
      _.each($("#todo-list .box"), function (e) {
        content = $(e).find('.todo-content')[0];
        var matchString = content.textContent;
        if (filter && matchString && matchString.search(new RegExp(filter, "i")) < 0) {
          $(e).addClass('invis');
        } else {
          $(e).removeClass('invis');
        }
      });
      $('#todo-list').masonry(this.masonry_opts);
    },

    // Clear all done todo items, destroying their models.
    clearCompleted: function() {
      _.each(Todos.done(), function(todo){ todo.clear(); });
      this.masonry = $('#todo-list').masonry(this.masonry_opts);
      return false;
    },
    

  });
  // Finally, we kick things off by creating the **App**.
  window.App = new AppView;

});
