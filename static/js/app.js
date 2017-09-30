(function($, document, window, viewport) {
  $(document).ready(function() {

    /*
      Arguments to pass to plot_growth() in routes.py
      (ajax data)
    */

    var plotData = {
      lowerLimit: 1,
      upperLimit: 1000,
      plotWidth: 1,
      plotHeight: 1,
      compareType: null
    };

    /*
      mpld3 figures are not responsive. Define the plot size in relation to
      window.innerWidth, window.innerHeight.
      We need dimensions in inches to pass into plot_growth() in routes.py.
      matplotlib Figure arguments are tuples of *integers* in inches: figsize=(width,height).
      Calculate inches by retrieving the ppi of a hidden 1-inch X 1-inch div (class="ppi").
      http://stackoverflow.com/questions/23606069/find-screen-dimensions-in-inches-not-pixels-using-javascript
    */
    var setPlotSize = function() {
      var ppiDiv = document.getElementsByClassName('ppi'),
          ppiX = ppiDiv[0].offsetWidth,
          ppiY = ppiDiv[0].offsetHeight,
          screenWidthInches = window.innerWidth / ppiX,
          screenHeightInches = window.innerHeight / ppiY,

          plotWidthInches = Waypoint.viewportWidth() >= 768 ?
                            Math.floor( screenWidthInches * 0.52 ) :
                            Math.floor( screenWidthInches * 0.72 ),
          plotHeightInches = Waypoint.viewportWidth() >= 768 ?
                            Math.floor( screenHeightInches * 0.62 ) :
                            Math.floor( screenHeightInches * 0.52 );

      plotData.plotWidth = plotWidthInches;
      plotData.plotHeight = plotHeightInches;
    };
    setPlotSize();


    /*
      In order to redraw the plot on waypoint scroll events and window resize
      events, while avoiding invocation of generatePlot() every time one of
      these events fires: a timed delay is required using setTimeout,
      i.e. we need a debounce() function.

      Implement debounce() to prevent multiple calls to plot_growth() and
      multiple mpld3 renderings. It will not trigger until it has *not* been
      invoked in [wait] milliseconds. [immediate] triggers on the leading
      edge instead of the trailing edge. This debounce() is adapted from
      Underscore.js and https://davidwalsh.name/javascript-debounce-function.
      I'm rewriting it here to learn from the work-through & think-through.
    */
    var timeout = null; // declare outside debounce scope so we can do clearTimeout() inside .waypoint callback fn
    var debounce = function(myFunction, wait, immediate) {
      // var timeout;

      return function() {
        var context = this,                   // store the this property to pass into function closures
            args = arguments,                 // store the arguments object to pass into function closures
            callNow = immediate && !timeout;  // define conditions for leading-edge firing

        var later = function() {              // later: to be fired on trailing edge of wait time
          timeout = null;                     // later() has fired, so reset to null ("unset") so callNow == true & is an option again
          if (!immediate) { myFunction.apply(context, args); }  // use apply() to pass in context of calling object (this)
        };

        // first, clear the timeout if one is set
        clearTimeout(timeout);
        /*
        then create a new timer: each time debounce() is called,
        this will overwrite the value of timeout, creating a new timer.
        this effectively cancels any existing timers, starting over, which makes debounce() work
        */
        timeout = setTimeout(later, wait);

        // immediate argument flag has been passed: call myFunction before the timer (?)
        if (callNow) { myFunction.apply(context, args); }
      };
    };
    // Function to pass to debounce(), and fire rate limit.
    var generatePlotWithDebounce = debounce(function() {
      setPlotSize();
      generatePlot();
    }, 800);
    // On window resize, call the debounced function generatePlotWithDebounce()
    window.addEventListener("resize", function() {
      if ( plotData.compareType ) {
        // plotData.plotWidth = setPlotSize();
        // plotData.plotHeight = setPlotSize();
        generatePlotWithDebounce();
      }
    });


    /*
      Trigger plot generation on scroll.
      Waypoints lib: create waypoint for matched elements: http://imakewebthings.com/waypoints/guides/jquery-zepto/
    */ 
    var plotInfo = document.getElementById("plot-info").outerHTML; // store this node prior to overwrite at line 259 (generatePLot())
    var scrollWaypoints = $( ".waypoint" ).waypoint(
      function( direction ) {
        if ( Waypoint.viewportWidth() >= 768 ) {
          if ( this.element.id != "what-is-big-o" ) {
              plotData.compareType = this.element.id;
              generatePlotWithDebounce();
          }
          else if ( direction == "up" ) {
            clearTimeout(timeout)
            if ( $("#plot-space").css("display") == "block" ) {
              $( "#plot-space" ).fadeTo( 600, 0, function() {
                document.getElementById("plot-space").innerHTML = plotInfo;
                $( "#plot-info" ).css( "opacity", "1" );
                $( "#plot-space" ).fadeTo( 600, 1 );
              });
            }
          }
        }
      }, { offset: "40%" });


    /*
      Create the slider input component
      https://refreshless.com/nouislider
    */
    var limitSlider = document.getElementById("limit-slider"),
        lowerLimitInput = document.getElementById("lower-limit-input"),
        upperLimitInput = document.getElementById("upper-limit-input");

    noUiSlider.create(limitSlider, {
      start: [1, 500],
      connect: [true, true, false],
      // behaviour: 'tap-drag',
      step: 1,
      margin: 1,
      range: {
        // if upper limit exceeds 1022, numeric.py throws an error (though not in asarray which converts values to floats (?))
        // numeric.py: line 460, in asarray: OverflowError: long int too large to convert to float
        'min': [1],
        'max': [1000]
      },
      format: wNumb({ decimals: 0 })
    });


    /*
       Bind the slider handle and input field values:
       *values* is always an array of strings. *handle* is 0 or 1 and
       indicates the handle that caused the event.
     */
    // Bind slider handle changes to input field values
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
    // Bind input field changes to slider handle values
    lowerLimitInput.addEventListener("change", function(values) {
      limitSlider.noUiSlider.set([this.value, values[1]]);
    });
    upperLimitInput.addEventListener("change", function(values) {
      limitSlider.noUiSlider.set([values[0], this.value]);
    });


    /*
       Add class "focused" on spans "[" and "]" for slider Input Range fields
       and for plot choice buttons
     */
    $( "input" ).on({
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
      Button styling helper / event handler:
      Re-style buttons on these events by adding/removing "focused" class
      Avoid MathJax element/class insertions: select .content-wrapper, filter to descendants .btn-plot-choice
      http://api.jquery.com/on/#on-events-selector-data
    */
    $( ".content-wrapper" ).on({
      "mouseover click": function() {
        $( ".btn-addon" ).addClass( "focused" );
      },
      "mouseout": function() {
        $( ".btn-addon" ).removeClass( "focused" );
      }
    }, ".btn-plot-choice");


    /*
      Button click events: generate chosen plot. Filter descendant
      to restrict classList to the object that exists before all MathJax insertions.
      Keep seperate from event handler code that is purely for styling,
      this seems preferable even though it repeats code(?).
    */
    $( ".content-wrapper" ).on('click', '.btn-plot-choice', function() {
      var plotChoice = this.classList[0];
      plotData.compareType = plotChoice;
      generatePlotWithDebounce();
    });


    /*
      $.ajax() method wrapper: submit updated state to plot_growth() in routes.py
      Assign $.ajax() method to a variable in order to use the .done() promise callback (more semantic?)
    */
    var generatePlot = function() {
      var getPlotSlide = $.ajax({
        type: "POST",
        contentType: "application/json",
        url: "/query",
        data: JSON.stringify( plotData ),
        dataType: "html"
      });
      getPlotSlide.done(function( data ) {
        // insert <br/> for quadraticExponential?

        if ( $( "#plot-info" ).css("display") == "block" ) {
          $( "#plot-info" ).fadeTo( 600, 0, function() {
            $( "#plot-space" ).fadeTo( 600, 1, function() {
              $( "#plot-space" ).html( data ).fadeTo( 600, 1 );
            });
          });
        } else {
          $( "#plot-space" ).fadeTo( 600, 0, function() {
            $( "#plot-space" ).fadeTo( 600, 1, function() {
              $( "#plot-space" ).html( data ).fadeTo( 600, 1 );
            });
          });
        }
      });
    };

  });
})(jQuery, document, window, ResponsiveBootstrapToolkit);
