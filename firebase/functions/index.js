// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion} = require('dialogflow-fulfillment');
const admin = require('firebase-admin');
var currentOrder = {};
var pizzaList = [];
admin.initializeApp({
	credential: admin.credential.applicationDefault(),
	databaseURL: 'ws://ym-pizzabot-mwxquc.firebaseio.com/',
});
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
 
  function welcome(agent) {
    agent.add(`Welcome to my agent, This is a pizza ordering bot for YoYo Pizza!`);
  }
 
  function fallback(agent) {
    agent.add(`I didn't understand`);
    agent.add(`I'm sorry, can you try again?`);
  }
  
	
	function initialize(){
		currentOrder = {
			type : undefined,
			pizzaname : undefined,
			size : undefined,
			count : 1,
			status : "Pending",
			name : undefined,
			phoneno : undefined,
			address : undefined,
			totalCost : undefined,
		};
		pizzaList = [];
	}

  function getOrderStatus(agent) {
	const orderid = agent.parameters.orderid;
	return admin.database().ref('orders').once("value").then((snapshot) => {
		var status = snapshot.child(orderid).child("status");
        if(status!==null){
	        status = status.val();
		agent.add("The order status says " + status);
        }
      else 
        agent.add("There is no data of orderid " + orderid);
	});
	
  }

  function listPizza(agent) {
	  initialize();
		const type = agent.parameters.pizzatype;
		currentOrder.type = type;
    	//console.log(currentOrder);
    
		return admin.database().ref('pizza').once("value").then((snapshot) => {
			var pizzas = snapshot.child(type);
			agent.add("Pizza name, Cost of Regular size");
			pizzas.forEach(function(childSnapshot){
				var childKey = childSnapshot.key;
				var childData = childSnapshot.val();
				pizzaList.push({name:childKey,cost:childData});
				agent.add(childKey + ', ₹' + childData);
			});
          	agent.add("Which pizza do you want to order ?");
          	agent.add("Please type in the exact name.");
		});
	}
	
	function updatePizzaName(agent){
		const pizzaname = agent.parameters.pizzaname;
		for (var i=0;i<pizzaList.length;i++){
			if(pizzaList[i].name.toLowerCase().search(pizzaname.toLowerCase())>=0){
				currentOrder.pizzaname = pizzaList[i].name;
				currentOrder.count = 1;
				currentOrder.totalCost = pizzaList[i].cost;
				return;
			}
		}
		agent.add("The " + pizzaname + " isn't available. You may restart the order.");
	}
	
	function updateSize(agent){
		const size = agent.parameters.size;
      	currentOrder.size = size;
		if (size === 'regular'){}
		else if (size === 'medium'){
			currentOrder.totalCost = parseInt(currentOrder.totalCost) + 0.6*parseInt(currentOrder.totalCost);
		}
		else if (size === 'large') {
			currentOrder.totalCost = parseInt(currentOrder.totalCost) + 0.8 *parseInt(currentOrder.totalCost);
		}
		else{
			agent.add("There was a problem with the size you mentioned. You may restart the order.");
		}
      //agent.add(currentOrder.size);
    }
	
	function updateCount(agent) {
		const count = agent.parameters.count;
		if(count>0){
			currentOrder.count = parseInt(count);
			currentOrder.totalCost = count * parseInt(currentOrder.totalCost);
			agent.add(currentOrder.type+", "+currentOrder.pizzaname + ", "+currentOrder.size + ","+currentOrder.count+", ₹"+currentOrder.totalCost);
			agent.add("Do you want to confirm this order ?  Yes or No ?");
		}
		else{
			agent.add("Invalid Count of pizza. You may restart the order.");
		}
      
	}
	
	function confirmOrder(agent){
		const confirmation = agent.parameters.confirmation;
		if(confirmation==="no"){
			currentOrder.status = "Not Confirmed";
			agent.add("You didn't confirm the order. Now, you may restart the order");
		}
		else if (confirmation=="yes"){
			currentOrder.status = "Confirmed";
			agent.add("Order confirmed. Please tell your name, phoneno and address.");
		}else{
        	currentOrder.status = "Cancelled";
          	agent.add("Order cancelled. You may try reordering");
        }
	}
	
	function bookOrder(agent){
		if (currentOrder.type === undefined || currentOrder.pizzaname ===undefined || currentOrder.size === undefined || currentOrder.name === undefined || currentOrder.phoneno===undefined||currentOrder.address===undefined){
			//agent.add("Type = " + currentOrder.type);
            //agent.add("\nPizza name = " + currentOrder.pizzaname);
            //agent.add("\nPizza size = " + currentOrder.size);
          	//agent.add("\nPizza count = " + currentOrder.count);	
          	//agent.add("\nName = "+currentOrder.name);
          	//agent.add("\nPhone no = "+currentOrder.phoneno);
          	//agent.add("\naddress = "+currentOrder.address);
          agent.add("\nSorry there was a error in booking. You may try reordering");
			return false;
		}
		else{
			return admin.database().ref('dbinfo').transaction((dbinfo) => {
				if(dbinfo !== null){
					let newid = dbinfo.neworderid;
					var ordersRef = admin.database().ref('orders');
                  	currentOrder.status = "Preparing";
					ordersRef.set({
						newid: currentOrder
					});
					dbinfo.neworderid += 1;
					agent.add("Order has been booked successfully. The order id is " + newid + ".");
					agent.add("\nYou can use this id to track the status.");
				}
				return dbinfo;
			},function(error, isSuccess){
				console.log("Order booked success status : " + isSuccess);
			}
			);
		}
	}
	function updateUserInfo(agent){
		const name = agent.parameters.name;
		const phoneno = agent.parameters.phoneno;
		const address = agent.parameters.address;
		currentOrder.name = name;
		currentOrder.phoneno = phoneno;
		currentOrder.address = address;
		bookOrder(agent);
	}
	
	function updateAll(agent){
		initialize();
		const type = agent.parameters.pizzatype;
		currentOrder.type = type;
		admin.database().ref('pizza').once("value").then((snapshot) => {
			var pizzas = snapshot.child(type);
			pizzas.forEach(function(childSnapshot){
				var childKey = childSnapshot.key;
				var childData = childSnapshot.val();
				pizzaList.push({name:childKey,cost:childData});
			});
		});
		updatePizzaName(agent);
		updateSize(agent);
		updateCount(agent);
		confirmOrder(agent);
		updateUserInfo(agent);
	}
  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // // Uncomment and edit to make your own Google Assistant intent handler
  // // uncomment `intentMap.set('your intent name here', googleAssistantHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function googleAssistantHandler(agent) {
  //   let conv = agent.conv(); // Get Actions on Google library conv instance
  //   conv.ask('Hello from the Actions on Google client library!') // Use Actions on Google library
  //   agent.add(conv); // Add Actions on Google library responses to your agent's response
  // }
  // // See https://github.com/dialogflow/fulfillment-actions-library-nodejs
  // // for a complete Dialogflow fulfillment library Actions on Google client library v2 integration sample

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set('Default Welcome Intent', welcome);
  intentMap.set('Default Fallback Intent', fallback);
  intentMap.set('take-order-id',getOrderStatus);
  intentMap.set('check-status',getOrderStatus);
  intentMap.set('take-pizzatype',listPizza);
  intentMap.set('take-pizzaname',updatePizzaName);
  intentMap.set('take-size',updateSize);
  intentMap.set('take-count',updateCount);
  intentMap.set('agree-confirmation',confirmOrder);
  intentMap.set('take-user-info',updateUserInfo);
  intentMap.set('take-all',updateAll);
  // intentMap.set('your intent name here', yourFunctionHandler);
  // intentMap.set('your intent name here', googleAssistantHandler);
  agent.handleRequest(intentMap);
});
