/*
     ____  _____ _____ _____ _____ _____ 
    |    \|  _  |   __|     | __  |  _  |
    |  |  |     |  |  |  |  | __ -|     |
    |____/|__|__|_____|_____|_____|__|__|
    
    dagoba: a tiny in-memory graph database

    ex: 
    V = [ {name: 'alice'}                                     // alice gets auto-_id (prolly 1)
        , {_id: 10, name: 'bob', hobbies: ['asdf', {x:3}] }
        ] 
    E = [ {_out: 1, _in: 10, _label: 'knows'} ]
    g = Dagoba.graph(V, E)
    
    g.addVertex({name: 'charlie', _id: 'charlie'})
    g.addVertex({name: 'delta', _id: '30'})

    g.addEdge({_out: 10, _in: 30, _label: 'parent'})
    g.addEdge({_out: 10, _in: 'charlie', _label: 'knows'})

    g.v(1).out('knows').out().run()                           // returns [charlie, delta]
    
    q = g.v(1).out('knows').out().take(1)
    q.run()                                                   // returns [charlie]
    q.run()                                                   // returns [delta]        // (but don't rely on result order!)
    q.run()                                                   // returns []
*/


Dagoba = {}

Dagoba.Query = {}

Dagoba.Query.add = function(list) {
  this.program.push(list)
  return this
}

Dagoba.query = function(graph) { 
  var query = Object.create(Dagoba.Query)
  
  query.done = -1                                             // behindwhich things have finished
  query.pc   = 0                                              // program counter
  query.program = []                                          // things to do
  
  query.graph = graph
  query.result = null
  query.gremlins = []                                         // array of gremlins for each step
  query.state = []                                            // array of state for each step
  
  return query
}

Dagoba.Query.run = function() {                               // special casing for run method
  
      var graph = this.graph
      var state = this.state
      var program = this.program
      var gremlins = this.gremlins


  this.done = -1  // clear the 'done' counter so we can get new results
                  // (components empty themselves, then return 'done', then we bump the counter past the component's slot)
  
  var max = program.length-1
  // var done = this.done
  var done = -1  // technically we don't need this.done... it's only useful if we want to pause mid-run and go async.
  var pc = max   // likewise for the program counter. is a mid-run pause a realistic use-case?
  var maybe_gremlin = false
  var results = []

  if(!program.length) return []                               // don't bother
  
  
  // driver loop
  while(done < max) {
    maybe_gremlin = try_step(pc, maybe_gremlin) // maybe_gremlin is a gremlin or (string | false)
    
    if(maybe_gremlin == 'pull') {
      maybe_gremlin = false
      if(pc-1 > done) {
        pc--
        continue
      } else {
        done = pc
      }
      // maybe_gremlin = 'done'
    }
    
    if(maybe_gremlin == 'done') {
      done = pc
      maybe_gremlin = false
    }
    
    pc++
    
    if(pc > max) { // a gremlin is popping out of the pipeline. catch it and bag it!
      if(maybe_gremlin)
        results.push(maybe_gremlin)
      maybe_gremlin = false
      pc--
    }
  }
  
  results = results.map(function(gremlin) {return gremlin.result ? gremlin.result : gremlin.vertex}) // make this a query component (or posthook)
  results = Dagoba.firehooks('postquery', this, results)[0] 
  
  return results
  
  function try_step(pc, maybe_gremlin) {
    var step = program[pc]
    var my_state = (state[pc] = state[pc] || {})
    if(!Dagoba.Funs[step[0]]) return Dagoba.onError('Unrecognized function call: ' + step[0]) || maybe_gremlin || 'pull'
    return Dagoba.Funs[step[0]](graph, step.slice(1) || {}, maybe_gremlin, my_state)
  }
  
  // TODO: deal with gremlin paths / history and gremlin "collisions"
  
  setbang_gremlins(0, stepper(0))                             // eat the first gremlin
  
  // process the program
  while(gremlins.length) {
    var gremlinbox = gremlins.pop()
    var result = stepper(gremlinbox[0], gremlinbox[1])
    // eat_result(gremlinbox[0], result)
    state[gremlinbox[0]] = result.state
    setbang_gremlins(gremlinbox[0], result)
  }
  
  // cultivate results
  // this.result = this.gremlins.filter(function(gremlin) {return gremlin.state == 'alive'})
  //                            .map(function(gremlin)    {return gremlin.path[gremlin.path.length-1]})
  var collection = this.state[this.state.length - 1] || []
  this.result = collection.map(function(gremlin) {return gremlin.vertex})

  this.result = Dagoba.firehooks('postquery', this, this.result)[0]

  return this.result

  
  function gremlin_boxer(step_index) { return function(gremlin) { return [step_index, gremlin] } }
  
  function stepper(step_index, gremlin) {
    var step = program[step_index]
    if(!Dagoba.Funs[step[0]]) return Dagoba.onError('Unrecognized function call: ' + step[0]) || {}
    return Dagoba.Funs[step[0]](graph, step.slice(1) || {}, gremlin || {}, state[step_index] || {})
  }
  
  function eat_gremlins(gremlins, step_index, result) {
    return gremlins.concat( (result.stay || []).map(gremlin_boxer(step_index))   )
                   .concat( (result.go   || []).map(gremlin_boxer(step_index+1)) ) }
  
  function setbang_gremlins(step_index, result) {gremlins = eat_gremlins(gremlins, step_index, result)}  
  
  /* 
      new idea: 
      - start with last component (collector)
      - it provides a 'pull' request as its return value
      - driver loop goes to previous component:
        - it might 'push' results
        - it might make a 'pull' request
        - it might be 'done'
  
      a query with a take(1) at the end provides one result at a time: you can keep calling it to get more results
      - this requires the take component to update itself on re-query: does it only provide 'done' once? 
        - once anything is 'done' everything above it is probably done also, so there's no backtracking?
        - it'd be better to toggle this on re-query: downstream components might be funky.
        - track it in the query? a list of 'done' components: don't even ask them.
      
      intersection/backtracking/etc... gremlin memory: it's not the vertex that arrives at the end, it's the gremlin.
      if we want history/state/replay then add that as a query stack modifier (inject between each queue item)
      likewise with gremlin collision (merging): query-inject it into the queue after collision-capable components
      
      (really query-injectors and query-transformers are the same: they're all just transformers. 
       can be run ad hoc, or added to the default queue-transformer list. [ordering? probably priority numbers... but proper dependencies / pre-pendencies (has to run before) would be better (a before/after list might be easy (but break cycles))])
  */
}

Dagoba.Funs = {
  vertex: function(graph, args, gremlin, state) {
    if(!state.vertices) state.vertices = graph.findVertices(args)
    if(!state.vertices.length) return 'done'
    var vertex = state.vertices.pop() 
    return Dagoba.make_gremlin(vertex)
    
    if(!gremlin.state)
      gremlin.state = graph.findVertices(args)
    if(gremlin.state.length == 0)
      return {} // original gremlin dies here...
    
    var vert = gremlin.state.pop()
    var vertex = graph.findVertexById(vert._id)
    var clone = Dagoba.make_gremlin(vertex)
    return {stay: [gremlin], go: [clone]}
  
    // if(state.status == 'done') return false    
    // var vertices = args[0] ? graph.findVertexById(args[0]) : graph.vertices
    // var gremlin = Dagoba.make_gremlin(vertex)
    // return {stay: [], go: [gremlin], state: {status: 'done'}}
    // return thread(args[0], graph.findVertexById, Dagoba.make_gremlin, ...)
    // return { gremlins: [{ state: 'alive', path: [graph.findVertexById(args[0])] }], history: ['done'] } 
  },
  
  out: function(graph, args, gremlin, state) {
    if(!gremlin && (!state.edges || !state.edges.length)) return 'pull'
    if(!state.edges || !state.edges.length) 
      state.edges = graph.findOutEdges(gremlin.vertex).filter(Dagoba.filterThings(args[0]))
    if(!state.edges.length) return 'pull'
    var vertex = state.edges.pop()._in // what?
    var clone = Dagoba.make_gremlin(vertex) // we lose history here: use clone_gremlin(gremlin).goto(vertex) instead
    return clone
  },
  
  outAllN: function(graph, args, gremlin, state) {
    var filter = args[0]
    var limit = args[1]-1
    
    if(!state.edgeList) { // initialize
      if(!gremlin) return 'pull'
      state.edgeList = []
      state.current = 0
      state.edgeList[0] = graph.findOutEdges(gremlin.vertex).filter(Dagoba.filterThings(filter))
    }
    
    if(!state.edgeList[state.current].length) { // finished this round
      if(state.current >= limit || !state.edgeList[state.current+1]   // totally done, or the next round has no items
                                || !state.edgeList[state.current+1].length) {
        state.edgeList = false
        return 'pull'
      }
      state.current++ // go to next round
      state.edgeList[state.current+1] = [] 
    }
    
    var vertex = state.edgeList[state.current].pop()._in
    
    if(state.current < limit) { // add all our matching edges to the next level
      if(!state.edgeList[state.current+1]) state.edgeList[state.current+1] = []
      state.edgeList[state.current+1] = state.edgeList[state.current+1].concat(
        graph.findOutEdges(vertex).filter(Dagoba.filterThings(filter))
      )
    }
    
    var clone = Dagoba.make_gremlin(vertex) // we lose history here: use clone_gremlin(gremlin).goto(vertex) instead
    return clone
  },
  
  inAllN: function(graph, args, gremlin, state) {
    var filter = args[0]
    var limit = args[1]-1
    
    if(!state.edgeList) { // initialize
      if(!gremlin) return 'pull'
      state.edgeList = []
      state.current = 0
      state.edgeList[0] = graph.findInEdges(gremlin.vertex).filter(Dagoba.filterThings(filter))
    }
    
    if(!state.edgeList[state.current].length) { // finished this round
      if(state.current >= limit || !state.edgeList[state.current+1]   // totally done, or the next round has no items
                                || !state.edgeList[state.current+1].length) {
        state.edgeList = false
        return 'pull'
      }
      state.current++ // go to next round
      state.edgeList[state.current+1] = [] 
    }
    
    var vertex = state.edgeList[state.current].pop()._out
    
    if(state.current < limit) { // add all our matching edges to the next level
      if(!state.edgeList[state.current+1]) state.edgeList[state.current+1] = []
      state.edgeList[state.current+1] = state.edgeList[state.current+1].concat(
        graph.findInEdges(vertex).filter(Dagoba.filterThings(filter))
      )
    }
    
    var clone = Dagoba.make_gremlin(vertex) // we lose history here: use clone_gremlin(gremlin).goto(vertex) instead
    return clone
  },
  
  in: function(graph, args, gremlin, state) {
    if(!gremlin && (!state.edges || !state.edges.length)) return 'pull'
    if(!state.edges || !state.edges.length) 
      state.edges = graph.findInEdges(gremlin.vertex).filter(Dagoba.filterThings(args[0]))
    if(!state.edges.length) return 'pull'
    var vertex = state.edges.pop()._out // what? // also, abstract this...
    var clone = Dagoba.make_gremlin(vertex) // we lose history here: use clone_gremlin(gremlin).goto(vertex) instead
    return clone
  },
  
  property: function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    gremlin.result = gremlin.vertex[args[0]]
    return gremlin
  },
  
  unique: function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    if(state[gremlin.vertex._id]) return 'pull' // we've seen this gremlin, so get another instead
    state[gremlin.vertex._id] = true
    return gremlin
  },
  
  filter: function(graph, args, gremlin, state) {
    if(!gremlin) return 'pull'
    if(typeof args[0] != 'function') return Dagoba.onError('Filter arg is not a function: ' + args[0]) || gremlin
    if(!args[0](gremlin.vertex)) return 'pull' // gremlin fails filter function // THINK: would we ever want to filter by other parts of the gremlin?
    return gremlin
  },
  
  take: function(graph, args, gremlin, state) {
    state.taken = state.taken ? state.taken : 0
    if(state.taken == args[0]) {
      state.taken = 0
      return 'done'
    }
    if(!gremlin) return 'pull'
    state.taken++ // FIXME: mutating! ugh!
    return gremlin
    
    
    return { state: (state.concat ? state : []).concat(gremlin) }
    // if(gremlin.state == args[0]) return {} // all done
    // gremlin.state = (gremlin.state || 0) + 1
    // return { state: (state.concat ? state : []).concat(gremlin) }
  },
}

Dagoba.make_fun = function(name) {
  return function() { return this.add([name].concat(Array.prototype.slice.apply(arguments))) } }

Object.keys(Dagoba.Funs).forEach(function(name) {Dagoba.Query[name] = Dagoba.make_fun(name)})
// var methods = ['out', 'in', 'take', 'property', 'outAllN', 'inAllN', 'unique', 'filter', 'outV', 'outE', 'inV', 'inE', 'both', 'bothV', 'bothE']

// special case for 'name' property
// Dagoba.Query['name'] = function() {Dagoba.Funs.property}


Dagoba.make_gremlin = function(vertex, state) {
  return {vertex: vertex, state: state}
}


Dagoba.hooks = {}
Dagoba.addhook = function(type, callback) {
  if(!Dagoba.hooks[type]) Dagoba.hooks[type] = []
  Dagoba.hooks[type].push(callback)
}

Dagoba.firehooks = function(type, query) {
  var args = [].slice.call(arguments, 2)
  return ((Dagoba.hooks || {})[type] || []).reduce(function(acc, callback) {return callback.apply(query, acc)}, args)
}





Dagoba.Graph = {}
Dagoba.Graph.v = function() {
  var query = Dagoba.query(this)
  query.add(['vertex'].concat( [].slice.call(arguments) ))
  return query
}

Dagoba.graph = function(V, E) { 
  var graph = Object.create( Dagoba.Graph )
  graph.vertices = [] // can't stick these on the prototype or they'll be shared
  graph.edges = []
  graph.vertexIndex = {}
  if(V && Array.isArray(V)) graph.addVertices(V)
  if(E && Array.isArray(E)) graph.addEdges(E)
  return graph
}

Dagoba.Graph.addVertex = function(vertex) {
  if(!vertex._id) 
    vertex._id = this.vertices.length+1
  // TODO: ensure unique _id
  this.vertices.push(vertex) // THINK: the user may retain a pointer to vertex, which they might mutate later >.<
  // can take away user's ability to set _id and lose the index cache hash, because building it causes big rebalancing slowdowns and runs the GC hard. (or does it?) [this was with a million items, indexed by consecutive ints. generally we need settable _id because we need to grab vertices quickly by external key]
  this.vertexIndex[vertex._id] = vertex
  vertex._out = []; vertex._in = []
}

Dagoba.Graph.addVertices = function(vertices) {
  vertices.forEach(this.addVertex.bind(this))
}

Dagoba.Graph.addEdge = function(edge) {
  if(!edge._label) return false
  edge._in  = this.findVertexById(edge._in)
  edge._out = this.findVertexById(edge._out)
  if(!(edge._in && edge._out)) return false
  edge._out._out.push(edge)
  edge._in._in.push(edge)
  this.edges.push(edge)
}

Dagoba.Graph.addEdges = function(edges) {
  edges.forEach(this.addEdge.bind(this))
}

Dagoba.Graph.findVertexById = function(vertex_id) {
  return this.vertexIndex[vertex_id]
  // return this.vertices.find(function(vertex) {return vertex._id == vertex_id})
}

Dagoba.Graph.findVerticesByIds = function(ids) {
  return ids.length ? ids.map(this.findVertexById.bind(this)).filter(Boolean) : this.vertices.slice()
}

Dagoba.Graph.findVertices = function(ids) {
  return !ids.length || typeof ids[0] != 'object' ? this.findVerticesByIds(ids) : this.searchVertices(ids)
}

Dagoba.Graph.searchVertices = function(obj) {
  return this.vertices.filter(
    function(vertex) {
      return Object.keys(obj[0]).reduce(
        function(acc, key) {
          return acc && obj[0][key] == vertex[key] }, true ) } ) }

Dagoba.Graph.findEdgeById = function(edge_id) {
  return Dagoba.find(this.edges, function(edge) {return edge._id == edge_id} ) }

Dagoba.Graph.findOutEdges = function(vertex) {
  return vertex._out;
  return this.edges.filter(function(edge) {return edge._out == vertex._id} ) }

Dagoba.Graph.findInEdges = function(vertex) {
  return vertex._in;
  return this.edges.filter(function(edge) {return edge._in == vertex._id} ) }

Dagoba.filterThings = function(arg) {
  return function(thing) {
    return !arg ? true : arg+''===arg ? thing._label == arg
                : Array.isArray(arg)  ? !!~arg.indexOf(thing._label) : Dagoba.objFilter(thing, arg) } }

Dagoba.objFilter = function(thing, obj) {
  for(var key in obj)
    if(thing[key] != obj[key])
      return false; return true }

// Array.prototype.find = function(fun) { // like ES6 // TODO: shim this properly
//   for (var i = 0, len = this.length; i < len; i++)
//     if(fun(this[i], i, this))
//       return this[i] }

Dagoba.find = function(arr, fun) {
    for (var i = 0, len = arr.length; i < len; i++)
      if(fun(arr[i], i, arr))
        return arr[i] }

Dagoba.cleanvertex = function(key, value) {return (key == '_in' || key == '_out') ? undefined : value} // for JSON.stringify
Dagoba.cleanedge   = function(key, value) {return key == '_in' ? value._id : key == '_out' ? value._id : value}

Dagoba.uniqueify = function (results) { // OPT: do this in the query via gremlin collision counting
  return [results.filter(function(item, index, array) {return array.indexOf(item) == index})]}

Dagoba.cleanclone = function (results) { // remove all _-prefixed properties
 return [results.map(function(item) {return JSON.parse(JSON.stringify(item, function(key, value) {return key[0]=='_' ? undefined : value}))})]}

// NOTE: add these hooks if you need them. (our vertex payloads are immutable, and we uniqueify prior to taking.)
// Dagoba.addhook('postquery', Dagoba.uniqueify)
// Dagoba.addhook('postquery', Dagoba.cleanclone)
// THINK: the uniquify hook happens after the take component so it smushes results down, possibly returning fewer than you wanted...
  

Dagoba.onError = function(msg) {
  console.log(msg)
  return false }