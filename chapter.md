# Let's make a graph database!

The dictionary defines "graph database" as a database for graphs. Thanks, dictionary! Let's break that down a little.
/// So we're going to build a graph database. We should probably figure out what that means first. 

A data base is like a fort for data. You can put data in it and get data back out of it.

A graph in this sense is a set of vertices and a set of edges. It's basically a bunch of dots connected by lines. 

So what's the simplest thing we can possibly build that could technically be called a "graph database"? We need a place to put some vertices and edges, and a way to get them back out.

/// So let's draw a shape: [stick man]. We'll number our vertices so we can keep track of them -- remember that graphs have no inherent "shape", so these graphs are all equivalent.

We're in JS, so let's make an array [1] of vertices: 

    [1] ES6 has proper sets, so if you're reading this from the future you can upgrade the datastructure:
      Set blah set set foo

  [var ]vertices = [1,2,3,4,5,6]
  
And an array of edges:
  
  [var ]edges = [ [1,2], [2,3], [3,1], [3,4], [4,5], [4,6] ]

Notice that we're modeling edges as a pair of vertices. Also notice that those pairs are ordered, because we're using arrays. That means we're modeling a *directed graph*, where every edge has a start and an end. [lines have arrows] We're doing it this way mostly because it's easier given our datastructure options, but it also adds a little complexity to our mental model because we have to keep track of the direction of edges. [2]

    [2] The upside of adding that complexity is that we can ask more interesting questions, like "which vertices point in to vertex 3?" or "which vertex has the most outgoing edges?". Also note that we can model an undirected graph by doubling up our edges array:
      function undirectMe (edges) 
        { return edges.reduce(function(acc, edge)
          { acc.push([ edge[0], edge[1] ])
            acc.push([ edge[1], edge[0] ]) }, []) }


//  Cool, we have a graph! Now for the database side -- we'll need some way to add new nodes and edges:
//  --> maybe we don't need this yet...
//  function addNode (node) { vertices.push(node) }
//  function addEdge (edge) { edges.push(edge) }

And some way to get information back out... what kinds of questions do we want to ask? We can ask about who our neighbors are:

  function into (node) 
    { return edges.reduce( function(acc, edge) 
      { return (edge[1] === node) ? acc.concat(edge[0]) : acc }, [] )}
  function out (node) 
    { return edges.reduce( function(acc, edge) 
      { return (edge[0] === node) ? acc.concat(edge[1]) : acc }, [] )}
  function neighbors (node) { return into(node).concat(out(node)) }

simpler:
  function matchAndConcat (node, side) 
    { return function (acc, edge) 
      { return (edge[side] === node) ? acc.concat( edge[1-side] ) : acc }}

  function into (node) { return edges.reduce( matchAndConcat(node, 1) )}

second neighbors:
  neighbors(4).map(neighbors).reduce(function(acc, nodes) {return acc.concat(nodes)}, [])

wouldn't that be nicer if we could just say 

  neighbors(neighbors(4))
  
sure, we can do that. just make everything take nodes instead of node

what if we want to filter the nodes we visit?

  function filter (nodes, fun) { return nodes.filter(fun) }


Or we could ask about the shortest path from one vertex to another:

  function shortestPath (node) {}

Let's run some tests! 

...

maybe we load in the collatz sequence as a test graph? http://xkcd.com/710/ [it's a tree, less interesting]
prime factors graph. [it's too connected, perhaps less interesting]
random graph (add 1-10, then each new node connects to 3 existing nodes selected at random) [just right (goldilocks graph)]
random graph, show threshold for connectivity (cite proof etc)
Watts-Strogatz small-world model simulator
Barabási–Albert model
Dorogovtsev and Mendes : http://arxiv.org/pdf/1007.4031v1.pdf

----

This is pretty good, but what if we care about more than just numbers? String labels should work fine. What about objects? 

  alice, bob, charlie, delta
  var nodes = [ alice, bob, charlie, delta ]
  var edges = [ [alice, bob], [bob, charlie], [charlie, delta], [charlie, alice], [bob, delta] ]

  neighbors... path... 

Hey, still works!

This is great, but what if we could use the vertex attributes in our query?

  ask about friends of charlie with blah blahs
  
Fun! But what if we want to ask about all of Alice's employees? Let's add some edge attributes.

  edge -> {_inV: A_id, _outV: B_id, _label: "employed", _id: 123, foo: "bar"}
  
[and of course a way to filter on edges / nodes...]

// TODO: change all node -> vertex   (/sigh)
// THINK: can you put the _id in the node/edge? does addNodes return a list of ids or a list of nodes? 
// property graph model

var g = Dagoba.graph()
g.addNodes([ {_id:1, name:"Fred"}, {_id:2, name:"Bob"}, {_id:3, name:"Tom"}, {_id:4, name:"Dick"}, {_id:5, name:"Harry"} ])
g.addEdges([ {_inV: 1, _outV: 2, _label: "father"}, {_inV: 2, _outV: 3, _label: "father"}, {_inV: 2, _outV: 4, _label: "father"}, {_inV: 2, _outV: 5, _label: "father"} ])

g.v(1).out().out('father').name    // TODO: check proxies for this -- can we use them? otherwise...
g.v(1).out().out('father').attr('name')
g.v(1).out().out('father').attr('name').paths()

so each of these g.xxx things is actually just adding elements to a query list, which can be optimized when something calls it and everything happens lazily. how do we do that?


function incoming (node) { return edges.reduce(function(edge) {if (edge[1] === node) acc.push(edge[0]) }, [])}
function outgoing (node) { return edges.reduce(function(edge) {if (edge[0] === node) acc.push(edge[1]) }, [])}
function neighbors (node) { return incoming(node).concat(outgoing(node)) }

//  I have quite a few more features to add and I want a debugger/visualizer/history thing 
//  and I want to convert it all to ES6 but this is where it's at right now.


make it right:

there's a problem here though -- it's really cumbersome to combine these questions. What if we wanted the nearest neighbor with a foo of bar?

use filters to create subgraphs...

a fluent style for creating subgraphs...

modularlize it so you can have multiple graphs and a nice api...

and allow query filters (and later optimizers) to be added at runtime...

then make it fast:

generate some graphs for testing...

put edge pointers inside nodes to optimize...

laziness for orthogonal optimization on the query pipeline...

more generated graphs for testing -- much faster!

non-enumerable properties for storing edges on nodes?

http://christopherolah.wordpress.com/2011/04/11/arithmetic-derivative-graph-and-thoughts/



-------------------  
  
  
  
a relational db of companies and people, with info on when each person worked at which company in a join table. ok, but now we want to know every person Joe Smith has worked with. duhn duhn duhn.


hercules.out('depictedIn').as('movie').out('hasActor').out('role').retain(hercules).back(2).out('actor').as('star').selected({ it:name })

--> note: back, as, selected, and edges only have their name instead of real properties

collision detection?
dags for parsing and rule-based systems and data flow etc

GraphSON https://github.com/tinkerpop/blueprints/wiki/GraphSON-Reader-and-Writer-Library

graph query language vs graph traversal language

Kahn process networks, tinkerpop pipes, gremlin and pacer, 

later: GraphML import/export support, https://github.com/lambdazen/pixy/wiki , 




step through debugger, reversible, 


updates:
- mutate in place
- remove and re-add
issues: 
- performance (mutate-in-place is a bit faster -- for large updates this probably matters)
- remove and re-add still has to connect to all the old pointers by _id: otherwise the old edges fail
  - also the only (natural) way to add loops and be a full graph
- normal issues with mutate-in-place apply: shared mutable state plus concurrency -> asplode
- but if we hand out references to the real nodes other things can mutate them, even if we don't

so: let's mutate-in-place for perf and simplicity, but never hand out refs to prevent mutation issues. it's a little slower because we have to serialize (or at least deep clone) before we hand over the results, but that part happens in a callback that we can cancel if our application doesn't need it.



















Definitions












# Querying

So now we've got a database and we'd like to make a query. Ideally, we'd say something like:
> Starting from vertex 5, follow every even* outgoing edge, then follow every odd* outgoing edge, then come back in on even* edges.

Ok, so how do we do that in js? well, maybe something like this:

Graph.V(5).out(even).out(odd).in(even)

[define even and odd lambdas]
And we can just pass values along:
V(5) sends an array containing vertex 5, and out and in both accept and return arrays of vertices. 
And this works great, until our graph gets large and connected and we write something like:
G.V(5).out().out().out().take(5)
and run out of memory before Dave Brubeck gets to play.

So we're going to need LAZINESS. 

How do we get laziness in JS? Well, we're using ES6 features, so generators come to mind. That could look like this.

-- good idea, but: can't go backward, can't orthopt, 

--> query transformer: id() -> attr('_id')


--> then we add label matching for easy edge walking
--> then we add object queries for more complicated stuff

# Updating

concurrency. immutable data structures. update syntax -- no problem, can't update directly anyway. {'foo.baz.smile': 123, 'args.lala.gogo': 333}




============================================================================


# Make it work

--> # graph, V&E, hobby like tennis, most of the above


# Make it right

So we've got a working graph database. It even works for fancy objects and stuff. So we're done, right? 
Well, what if we did a query like this:
> G.v(-23).out([2,3,4]).take('a')

Maybe we should do some error checking. [yep]

What happens if someone grabs some data while someone else updates some data? What if two folks update at the same time? 



# Make it fast

All production graph databases have a very particular performance characteristic in common: graph traversal queries are constant time with respect to total graph size. [the fancy term for this is "index-free adjacency"] In a non-graph database, asking for the list of someone's friends can require time proportional to the number of entries, if it has to look at every entry. The means if a query over ten entries takes a millisecond then a query over ten million entries will take almost two weeks. Your friend list would arrive faster if sent by Pony Express! [N] [Though only in operation for 18 months due to the arrival of the transcontinental telegraph and the outbreak of the American Civil War, the Pony Express is still remembered today for delivering mail coast to coast in just ten days.]

// do a perf test with the O(n) graph

To alleviate this dismal performance most databases index over oft-queried fields, which turns an O(n) search into an O(log n) search. This gives considerably better search time performance, but at the cost of some write performance and a lot of space -- indices can easily double the size of a database. Much of the modern DBA's role lies in carefully balancing these time/space tradeoffs and tediously tending to the index garden, weeding out unneeded indices and adding new ones when necessary. [replace this]

// add an index
// do a perf test with an indexed graph

Graph databases sidestep this issue by making direct connections between vertices and edges, so graph traversals are just pointer jumps: no need to read through everything, no need for indices. Now finding your friends has the same price regardless of total number of people in the graph, with no additional space cost or write time cost. One downside to this approach is that the pointers work best when the whole graph is in memory on the same machine. Sharding a graph across multiple machines is still an active area of research. [N] [point to a couple graph theory papers on NP-completeness of optimal splitting, but also some practical takes on this that mostly work ok]

// add pointers
// perf test
// wow such perform

### Orthogonal Optimization

We've improved our performance for large graphs by several dozen orders of magnitude. That's pretty good, but we can do better. Each step in our query has a fixed cost for building the gremlins and making the function calls, as well as a per-step cost. Because we're splitting each step out into its own separate unit, those per-step costs can be quite high compared to what they could be if we could combine some steps. We've sacrificed performance for code simplicity. 
Many will argue that this sacrifice is acceptable, and that simplicity should trump performance whenever possible, but this is a false dichotomy. We can have our simple, easily understood model and also gain the performance benefits of combining steps -- we just have to beef up our compiler a little. 
How do we do that without sacrificing simplicity? By making the new compilation steps orthogonal to our existing model. We already have a working system, so keep that in place. But let's add some new stepflavours, and some new preprocessors that we can turn on to pull those flavours in to our pipeline. We'll tag the preprocessors so we can turn them all on or off easily. 

// ok build that
// perf test it
// cool it's faster

Great, we're fast! Notice that by deliberately ignoring the chances we had to optimize early and by writing everything in as decomposed and simplistic a way as we possibly could that we've opened up opportunities for global optimizations. [more]

We should probably confirm that our optimizations don't break anything. Maybe we can write a bunch of tests for each of these new pieces, like we did before. 

// write a test or two

This is *really* boring... and error prone. And it doesn't reveal any of the unexpected ways that combinations of optimizations may interact, or how the preprocessor affects that. Ok, new plan: probabilistic testing!
Because we have a working, well-tested pipeline and because we've created our optimizations as an optional, orthogonal pipeline we can now write tests that take advantage of this fact.

// build a random graph
// build a random query
// compare opt and non-opt flavours

We've created a (very specialized) version of quickcheck [N] in 9 lines of code! Now we just let this run for awhile whenever we add new optimizations and it will tell us when they fail.





