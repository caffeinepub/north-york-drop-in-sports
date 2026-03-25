import Time "mo:core/Time";
import Outcall "http-outcalls/outcall";

actor {
  stable var cachedData : Text = "";
  stable var cacheTimestamp : Int = 0;

  let CACHE_TTL_NS : Int = 3_600_000_000_000; // 1 hour

  let API_URL : Text = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search_sql?sql=SELECT%20%22Location%20ID%22%2C%22Course%20Title%22%2C%22Age%20Min%22%2C%22Age%20Max%22%2C%22First%20Date%22%2C%22Last%20Date%22%2C%22DayOftheWeek%22%2C%22Start%20Hour%22%2C%22Start%20Minute%22%2C%22End%20Hour%22%2C%22End%20Min%22%20FROM%20%22c99ec04f-4540-482c-9ee4-efb38774eab4%22%20WHERE%20%22Location%20ID%22%20IN%20(693%2C1463%2C499%2C643%2C42)%20AND%20%22Section%22%3D%27Sports%20-%20Drop-In%27&limit=5000";

  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    { input.response with headers = [] };
  };

  public func getDropInSports() : async Text {
    let now = Time.now();
    if (cachedData != "" and (now - cacheTimestamp) < CACHE_TTL_NS) {
      return cachedData;
    };
    let response = await Outcall.httpGetRequest(API_URL, [], transform);
    cachedData := response;
    cacheTimestamp := now;
    response;
  };

  public func refreshData() : async Text {
    cacheTimestamp := 0;
    await getDropInSports();
  };

  public query func getCacheAge() : async Int {
    if (cacheTimestamp == 0) return -1;
    (Time.now() - cacheTimestamp) / 1_000_000_000;
  };
}
