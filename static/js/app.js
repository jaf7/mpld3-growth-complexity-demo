(function($, document, window, viewport) {
  $(document).ready(function() {
    //var viewport = ResponsiveBootstrapToolkit;

    // Arguments to pass to plot_growth() in routes.py
    var plotData = {
      lowerLimit: 1,
      upperLimit: 1000,
      plotWidth: 8,
      plotHeight: 7,
      compareType: null // if still null, no calls to genPlot()
    };
    var plotChosen = plotData.compareType;


    /*
      mpld3 figures are not responsive: On document.ready(),
      pass appropriate matplotlib Figure instance arguments
      (figsize=[tuple], w,h in inches) relative to bootstrap
      viewport breakpoints, using Responsive Bootstrap Toolkit .is()
      method.
      How to avoid duplicating this code? (see viewportChanged below)
    */
    if (viewport.is('<=sm')) {
      plotData.plotWidth = 6;
      plotData.plotHeight = 5;
    }
    if (viewport.is('md')) {
      plotData.plotWidth = 6;
      plotData.plotHeight = 5;
    }
    if (viewport.is('>md')) {
      plotData.plotWidth = 6;
      plotData.plotHeight = 5;
    }


    /*
      mpld3 figures are not responsive:
      window resize events should trigger re-drawing figure at appropriate
      dimensions. debounce() prevents multiple calls to plot_growth() and
      multiple mpld3 renderings. It will not trigger until it hasn't been
      invoked in [wait] milliseconds. [immediate] triggers on the leading
      edge instead of the trailing edge. This debounce() is adapted from
      Underscore.js and https://davidwalsh.name/javascript-debounce-function.
    */
    var debounce = function(myFunction, wait, immediate) {
      var timeout;
      return function() {
        var context = this,
          args = arguments;                   // store the correct references to pass into closures
        var callNow = immediate && !timeout;  // conditions for leading-edge firing
        var later = function() {              // to be fired on trailing edge of wait time
          timeout = null;                     // fired, reset to null so callNow is an option again
          if (!immediate) { myFunction.apply(context, args); }  // use apply() to pass in context of calling object (this)
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);    // why does this get invoked though it's stored in a variable? <--??
        if (callNow) { myFunction.apply(context, args); }
      };
    };
    /*
      On window resize: function to pass to debounce(), and fire rate limit.
      How to avoid duplicating this code? (Can't pass a
      reference into debounce() inner function scopes, so
      conditional code is repeated here-- how to avoid this?)
    */
    var viewportChanged = debounce(function() {
      if (viewport.is('<=sm')) {
        plotData.plotWidth = 6;
        plotData.plotHeight = 5;
      }
      else if (viewport.is('md')) {
        plotData.plotWidth = 6;
        plotData.plotHeight = 5;
      }
      else if (viewport.is('>md')) {
        plotData.plotWidth = 7;
        plotData.plotHeight = 6;
      }
      genPlot();
    }, 500);
    // On resize, call viewportChanged
    window.addEventListener("resize", function() {
      if ( plotChosen ) { viewportChanged(); }
    });


    /*
      Removed buttons temporarily (relocate)
      Handle click events on buttons. Use jQuery .on() method
      to filter the child element. This restricts the classList to
      the object existing before MathJax class insertions.
    */
    // $(".btn-flex-container").on('click', '.btn-plot-choice', function() {
    //   var compareChoice = this.classList[0];
    //   plotData.compareType = compareChoice;
    //   genPlot();
    // });


    /*
      Waypoints function, trigger when scrolling to
      .growthDescription elements
      -- add debounce()?
      -- refine: selectively trigger (for ex. don't
         trigger when scrolling back up to last element)
    */
    var scrollWaypoints = $( ".growthDescription" ).waypoint(
      function() {
        var plotType = this.element.id;
        plotData.compareType = plotType;
        console.log( "plotType", plotType);
        console.dir(this);
        var thisClientHeight = this.element.clientHeight,
            thisClientHeightDiv2 = Math.floor( this.element.clientHeight/2 );
        console.log( "clientHeight: ", thisClientHeight );
        console.log( "clientHeight/2: ", thisClientHeightDiv2 );
        genPlot();
      },
      { offset: "40%" }
    );


    /*
      Slider creation, binding, and styling
      https://refreshless.com/nouislider
      (no jQuery)
    */
    // -- Create the slider
    var limitSlider = document.getElementById("limit-slider"),
        lowerLimitInput = document.getElementById("lower-limit-input"),
        upperLimitInput = document.getElementById("upper-limit-input");
    noUiSlider.create(limitSlider, {
      start: [1, 1000],
      connect: [true, true, false],
      behaviour: 'tap-drag',
      step: 1,
      margin: 1,
      range: {
        'min': [1],
        'max': [5000]
      },
      format: wNumb({
        decimals: 0
      })
    });
    /*
       Binding slider handle and input field values:
       values is alwas an array of strings. handle is 0 or 1 and
       indicates the handle that caused the event.
     */
    // -- Bind slider handle changes to input field values
    limitSlider.noUiSlider.on("update", function(values, handle) {
      // Need a Number to pass to plot_growth in routes.py
      var currentValue = parseInt(values[handle]);
      if (handle === 0) {
        lowerLimitInput.value = currentValue;
        plotData.lowerLimit = currentValue;
      } else {
        upperLimitInput.value = currentValue;
        plotData.upperLimit = currentValue;
      }
    });
    // -- Bind input field changes to slider handle values
    lowerLimitInput.addEventListener("change", function(values) {
      limitSlider.noUiSlider.set([this.value, values[1]]);
    });
    upperLimitInput.addEventListener("change", function(values) {
      limitSlider.noUiSlider.set([values[0], this.value]);
    });
    // -- Styling of addons "[" and "]": handler for input field focus events
    $( "input" ).on( {
      focusin: function() {
        var lowerBrackets = $( "#basic-addon1, #basic-addon2" ),
            upperBrackets = $( "#basic-addon3, #basic-addon4" );
        if ( event.target == lowerLimitInput ) {
          $( lowerBrackets ).addClass( "focused" );
        }
        else if ( event.target == upperLimitInput ) {
          $( upperBrackets ).addClass( "focused" );
        }
      },
      focusout: function() {
        $( "span.input-group-addon" ).removeClass( "focused" );
      }
    });


    /*
      $.ajax() method wrapper: submit updated state to plot_growth() in routes.py
      (why doesn't it work to call getPlotSlide directly?) <--??
      Assign $.ajax() method to a variable in order to use .done()
      promise callback in a more readable fashion.
    */
    var genPlot = function() {
      var getPlotSlide = $.ajax({
        type: "POST",
        contentType: "application/json",
        url: "/query",
        data: JSON.stringify( plotData ),
        dataType: "html"
      });
      getPlotSlide.done(function(data) {
        $("#plot-space").fadeTo(200, 0, function() {
          $("#plot-space").html(data).fadeTo(200, 1);
        });
        // $("#show-text").fadeTo(500, 0, function() {
        //   $(this).html(descriptions[plotData.compareType]).fadeTo(500, 1, function() {});
        // });
      });
    };


  });
})(jQuery, document, window, ResponsiveBootstrapToolkit);
