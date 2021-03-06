    $(document).ready(function() {	  	  
	  var quote = $("#quote").text();
	  var title = $("#title").text();	  
	  $("#share_anchor").attr("href", "https://twitter.com/intent/tweet?text=" + encodeURIComponent(quote + title));
      
	  function getQuote() {
	    WikiquoteApi.getCompletelyRandomQuote(function (newQuote) {
		  quote = newQuote.quote;
          title = newQuote.titles;
          if (quote && title) {
		    $('#quote').replaceWith('<p id="quote">"' + quote + '"</p>');
			$('#title').replaceWith('<p id="title" style="text-align:right">- ' + title + "</p>");
		    $("#share_anchor").attr("href", "https://twitter.com/intent/tweet?text=" + encodeURIComponent(quote + "-" + title));
		  }		   
		})
	  }
	  
	  function randomColor() {
        var colorArr = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "A", "B", "C", "D", "E", "F"];
        var colorVal = "#";
        for(i = 0; i < 6; i++) {
            colorVal += colorArr[Math.round(15*Math.random())];
        }
        return colorVal;
      }	  
	  
	  function changeColor() {      	  
        var newColor = randomColor();
		$("body").css("background-color",newColor);
		$("h1").css("color",newColor);
		//$("#quote").css("color",newColor);
		//$("#title").css("color",newColor);
		$("#quoteDiv").css("color",newColor);
		$("#share").css("background-color",newColor);
		$("#bt_new_quote").css("background-color",newColor);
		$("#foot_er").css("color",newColor);
		$("hr").css({"background-color":newColor, "color":newColor});
      }
      
	  $("#bt_new_quote").click(function() {		
		getQuote();
        changeColor();		  
      });
	});
	
    // WikiquoteApi thanks to Nate Tyler. https://github.com/natetyler/wikiquotes-api

    var WikiquoteApi = (function() {

      var wqa = {};
      var API_URL = "https://en.wikiquote.org/w/api.php";

    /**
     * Query based on "titles" parameter and return page id.
     * If multiple page ids are returned, choose the first one.
     * Query includes "redirects" option to automatically traverse redirects.
     * All words will be capitalized as this generally yields more consistent results.
    */
    wqa.queryTitles = function(titles, success, error) {
      $.ajax({
        url: API_URL,
        dataType: "jsonp",
        data: {
          format: "json",
          action: "query",
          redirects: "",
          titles: titles
        },
        success: function(result, status) {
          var pages = result.query.pages;
          var pageId = -1;
          for(var p in pages) {
            var page = pages[p];
            // api can return invalid recrods, these are marked as "missing"
            if(!("missing" in page)) {
              pageId = page.pageid;
              break;
            }
          }
          if(pageId > 0) {
            success(pageId);
          } else {
            error("No results");
          }
        },
        error: function(xhr, result, status){
          error("Error processing your query");
        }
      });
    };

    wqa.queryRandomTitle = function(success, error) {
      $.ajax({
        url: API_URL,
        dataType: "jsonp",
        data: {
          format: "json",
          action: "query",
          redirects: "",
          list: "random",
          rnnamespace: "0"
        },
        success: function(result, status) {
          var title = result.query.random[0].title;
          if(title !== undefined) {
            success(title);
          } else {
            error("No results");
          }
        },
        error: function(xhr, result, status){
          error("Error processing your query");
        }
      });
    };

  /**
   * Get the sections for a given page.
   * This makes parsing for quotes more manageable.
   * Returns an array of all "1.x" sections as these usually contain the quotes.
   * If no 1.x sections exists, returns section 1. Returns the titles that were used
   * in case there is a redirect.
   */
  wqa.getSectionsForPage = function(pageId, success, error) {
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "parse",
        prop: "sections",
        pageid: pageId
      },

      success: function(result, status){
        var sectionArray = [];
        var sections = result.parse.sections;
        for(var s in sections) {
          var splitNum = sections[s].number.split('.');
          if(splitNum.length > 1 && splitNum[0] === "1") {
            sectionArray.push(sections[s].index);
          }
        }
        // Use section 1 if there are no "1.x" sections
        if(sectionArray.length === 0) {
          sectionArray.push("1");
        }
        success({ titles: result.parse.title, sections: sectionArray });
      },
      error: function(xhr, result, status){
        error("Error getting sections");
      }
    });
  };

  /**
   * Get all quotes for a given section.  Most sections will be of the format:
   * <h3> title </h3>
   * <ul>
   *   <li>
   *     Quote text
   *     <ul>
   *       <li> additional info on the quote </li>
   *     </ul>
   *   </li>
   * <ul>
   * <ul> next quote etc... </ul>
   *
   * The quote may or may not contain sections inside <b /> tags.
   *
   * For quotes with bold sections, only the bold part is returned for brevity
   * (usually the bold part is more well known).
   * Otherwise the entire text is returned.  Returns the titles that were used
   * in case there is a redirect.
   */
  wqa.getQuotesForSection = function(pageId, sectionIndex, success, error) {
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "parse",
        noimages: "",
        pageid: pageId,
        section: sectionIndex
      },

      success: function(result, status){
        var quotes = result.parse.text["*"];
        var quoteArray = [];

        // Find top level <li> only
        var $lis = $(quotes).find('li:not(li li)');
        $lis.each(function() {
          // Remove all children that aren't <b>
          $(this).children().remove(':not(b)');
          var $bolds = $(this).find('b');

          // If the section has bold text, use it.  Otherwise pull the plain text.
          if($bolds.length > 0) {
            quoteArray.push($bolds.html());
          } else {
            quoteArray.push($(this).html());
          }
        });
        success({ titles: result.parse.title, quotes: quoteArray });
      },
      error: function(xhr, result, status){
        error("Error getting quotes");
      }
    });
  };

  /**
   * Search using opensearch api.  Returns an array of search results.
   */
  wqa.openSearch = function(titles, success, error) {
    $.ajax({
      url: API_URL,
      dataType: "jsonp",
      data: {
        format: "json",
        action: "opensearch",
        namespace: 0,
        suggest: "",
        search: titles
      },

      success: function(result, status){
        success(result[1]);
      },
      error: function(xhr, result, status){
        error("Error with opensearch for " + titles);
      }
    });
  };

  /**
   * Get a random quote for the given title search.
   * This function searches for a page id for the given title, chooses a random
   * section from the list of sections for the page, and then chooses a random
   * quote from that section.  Returns the titles that were used in case there
   * is a redirect.
   */
  wqa.getRandomQuote = function(titles, success, error) {

    var errorFunction = function(msg) {
      error(msg);
    };

    var chooseQuote = function(quotes) {
      var randomNum = Math.floor(Math.random()*quotes.quotes.length);
      success(
         { titles: quotes.titles, quote: quotes.quotes[randomNum] }
        //console.log("Author: " +quotes.titles + " Quote: " + quotes.quotes[randomNum])
      );
    };

    var getQuotes = function(pageId, sections) {
      var randomNum = Math.floor(Math.random()*sections.sections.length);
      wqa.getQuotesForSection(pageId, sections.sections[randomNum], chooseQuote, errorFunction);
    };

    var getSections = function(pageId) {
      wqa.getSectionsForPage(pageId, function(sections) { getQuotes(pageId, sections); }, errorFunction);
    };

    wqa.queryTitles(titles, getSections, errorFunction);
  };

  wqa.getCompletelyRandomQuote = function(success, error) {
      wqa.queryRandomTitle(function(title) {
          wqa.getRandomQuote(title, success, error);
      }, error);
  };

  /**
   * Capitalize the first letter of each word
   */
  wqa.capitalizeString = function(input) {
    var inputArray = input.split(' ');
    var output = [];
    for(s in inputArray) {
      output.push(inputArray[s].charAt(0).toUpperCase() + inputArray[s].slice(1));
    }
    return output.join(' ');
  };

  return wqa;
 }());
