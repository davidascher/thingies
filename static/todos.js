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
    toggle: function() {
      this.save({done: !this.get("done")});
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

  // Create our global collection of **Todos**.
  window.Todos = new TodoList;

  // Todo Item View
  // --------------

  // The DOM element for a todo item...
  window.TodoView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "li",

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
      this.$('.todo-content').text(content);
      this.$('.todo-input').val(content);
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
    },
    toggleSelect: function() {
      this.model.toggleSelect();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      $(".editing").removeClass('editing');
      $(this.el).addClass("editing");
      $(".editing input").select();
      $(".editing input").focus();
    },

    // If you hit enter, submit the changes to the todo item's `content`.
    updateOnEnter: function(e) {
      if (e.keyCode != 13) return;
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
      "keyup #filter": "filterKeyup"
    },

    // At initialization we bind to the relevant events on the `Todos`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting todos that might be saved in *localStorage*.
    initialize: function() {
      _.bindAll(this, 'addOne', 'addAll', 'render');

      this.input    = this.$("#new-todo");
      this.tags = ['work', 'home', 'shopping'];
      this.words = {};

      Todos.bind('add',     this.addOne);
      Todos.bind('refresh', this.addAll);
      Todos.bind('all',     this.render);
      Todos.fetch();

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
      this.autocomplete = $("#new-todo").autocomplete(window.tags, {
        multiple: true,
        multipleSeparator: " ",
        autoFill: true,
      });

      // disabling sortable because interacts badly w/ selection (move and things get unselected)
      //$( ".sortable" ).sortable({
      //  handle: '.handle',
      //  revert: true
      //});
      $( ".cell" ).disableSelection();
      
      // XXX Move this to backbone model
      $("html").keydown(_.bind(this.keypress, this));
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
      
      el = this.$("#todo-list").append(view.render().el);
      el.view = view;
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
      this.autocomplete.setOptions({data: tags});
    },

    // Add all items in the **Todos** collection at once.
    addAll: function() {
      Todos.each(this.addOne);
      this.updateTags();
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
    },

    keypress: function(e) {
      if (e.which == 32) { // Space bar toggles Done state on all selected todos
        if (! $(e.target).find('#todos').length) {
          return;
        }
        _.each(Todos.selected(), function(todo){ todo.toggle(); });
        e.preventDefault();
        e.stopPropagation();
      }
      else if (e.which == 27) { // Escape clears selection
        _.each(Todos.selected(), function(todo){ todo.toggleSelect(); });
        e.preventDefault();
        e.stopPropagation();
      }
      //else if (e.which == 8) { // capture back?
      ////  _.each(Todos.selected(), function(todo){ todo.toggleSelect(); });
      //  e.preventDefault();
      //  e.stopPropagation();
      //}
    },
    
    filterKeyup: function(event) {
      var filterNode = $(event.target);
      var filter = filterNode.val();
      _.each($("li"), function (e) {
        content = $(e).find('.todo-content')[0];
        var matchString = content.textContent;
        if (matchString && matchString.search(new RegExp(filter, "i")) < 0)
          $(e).hide();
        else
          $(e).show();
      });
    },

    // Clear all done todo items, destroying their models.
    clearCompleted: function() {
      _.each(Todos.done(), function(todo){ todo.clear(); });
      return false;
    },

  });
  // Finally, we kick things off by creating the **App**.
  window.App = new AppView;

});
