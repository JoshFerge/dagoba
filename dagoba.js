Dagoba = {}

Dagoba.Query = {}

Dagoba.Query.add = function(list) {
  this.queue.push(list)
  return this
}

Dagoba.make_fun = function(name) {
  return function() { return this.add([name].concat(Array.prototype.slice.apply(arguments))) } }

Dagoba.query = function(graph) { 
  var query = Object.create(Dagoba.Query) 
  query.queue = []
  query.graph = graph
  query.result = null
  query.pointer = 0
  query.history = [] // array of arrays, mapping queue position to state stack
  query.gremlins = [] // gremlins are really just path lists
  return query
}

Dagoba.Query.run = function() {
  // for each queue element: invoke the attached function once, pass input to next function, until end
  // after end, back up to each function until you find one that still gives results, then move forward
  // if you reach the beginning and have no results, stop.
  // need a way for 'take 10' to keep everything prior to it from churning... the difference between 'no further results' and 'done'
  
  // THINK: run all the transformers first
  // THINK: check all the queue funs in Funs
  
  // DONE CONDITIONS:
  // - all gremlins are dead (good or bad)
  // - 'done' instead of 'no further results' [are these equivalent? can you get 'done' w/o being done? like g.out.take(10).out.take(5) ?]
  
  if(!this.queue.length) {
    this.result = []
    return this }
  
  // bootstrap
  var item = this.queue[this.pointer]
  var history = this.history[this.pointer] || []
  var foo = Dagoba.Funs[item[0]](this.graph, this.gremlins, history, item.slice(1))
  this.gremlins = foo.gremlins // ugh this is unnecessary 
  this.history[this.pointer] = foo.history[this.pointer] // kinda this too (but kinda not)
  
  
  this.result = this.gremlins.filter(function(gremlin) {return gremlin.state == 'alive'})
                             .map(function(gremlin)    {return gremlin.path[gremlin.path.length-1]})
  return this
}

Dagoba.Query.name = function() {
  this.add(['name'])
  this.run()
  return this.result
  // return this.result.map(function(vertex) {return vertex.name})  // THINK: maybe this instead
}

var methods = ['out', 'outV', 'outE', 'in', 'inV', 'inE', 'both', 'bothV', 'bothE', 'filter', 'foo']
methods.forEach(function(name) {Dagoba.Query[name] = Dagoba.make_fun(name)})

Dagoba.Funs = {
  vertex: function(graph, gremlins, history, args) {
    return { gremlins: [{ state: 'alive', path: [graph.findVertexById(args[0])] }], history: ['done'] } }
  
  out: function(graph, gremlins, history, args) {
    // oh geez the gremlins need to know where they are
    // so it's not just a path it's a pointer as well 
    // and the last step in the path points to the current graph step thing
    // ok so do we need history too or just gremlins do everything everything?
    // because we know when they're sleeping 
    // and we know when they're awake
    // so can they do it themselves
    // and we'll interleave their histories?
    
    gremlins.
    return { gremlins: [{}], history: [] }
  }
}


Dagoba.Graph = {}
Dagoba.Graph.v = function(v_id) {
  var query = Dagoba.query(this)
  query.add(['vertex', v_id])
  return query
}

Dagoba.graph = function() { 
  var graph = Object.create( Dagoba.Graph ) 
  graph.vertices = []
  graph.edges = []
  return graph
}

Dagoba.Graph.addVertex = function(vertex) {
  if(!vertex._id) 
    vertex._id = graph.vertices.length+1
  this.vertices.push(vertex)
}

Dagoba.Graph.addEdge = function(edge) {
  if(!edge._label) return false
  if(!this.findVertexById(edge._in)) return false
  if(!this.findVertexById(edge._out)) return false
  this.edges.push(edge)
}

Dagoba.Graph.findVertexById = function(vertexId) {
  return this.vertices.first(function(vertex) {return vertex._id == vertexId})
}

Array.prototype.first = function(fun) {
  for (var i = 0, len = this.length; i < len; i++)
    if(fun(this[i]))
      return this[i]
}

// practice makes perfect

var g = Dagoba.graph()

g.addVertex({_id: 1, name: 'foo', type: 'banana'})
g.addVertex({_id: 2, name: 'bar', type: 'orange'})
g.addEdge({_in: 1, _out: 2, _label: 'fruitier'})

q = g.v(1).out().run()
console.log(q, q.result)


// g.addNodes([ {_id:1, name:"Fred"}, {_id:2, name:"Bob"}, {_id:3, name:"Tom"}, {_id:4, name:"Dick"}, {_id:5, name:"Harry"} ])
// g.addEdges([ {_inV: 1, _outV: 2, _label: "father"}, {_inV: 2, _outV: 3, _label: "father"}, {_inV: 2, _outV: 4, _label: "father"}, {_inV: 2, _outV: 5, _label: "father"} ])
// 
// g.v(1).out().out('father').name    // TODO: check proxies for this -- can we use them? otherwise...
// g.v(1).out().out('father').attr('name')
// g.v(1).out().out('father').attr('name').paths()
// 
