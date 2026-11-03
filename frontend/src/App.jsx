
import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";

import "./App.css";

import GetCurrentUser from "./hooks/GetCurrentUser";
import GetSuggestedUsers from "./hooks/Getsugesteduser";


export const ServerUrl = import.meta.env.DEV
  ? "http://localhost:5000"
  : window.location.origin;


const Signup = lazy(() => import("./components/Signup"));
const Signin = lazy(() => import("./components/Signin"));
const Home = lazy(() => import("./components/Home"));
const Forgotpassword = lazy(() => import("./components/Forgotpassword"));

const Aiimg = lazy(() => import("./components/Aiimg"));
const Profile = lazy(() => import("./components/Profile"));
const Editprofile = lazy(() => import("./components/Editprofile"));
const Upload = lazy(() => import("./components/Upload"));

const Reels = lazy(() => import("./components/Reels"));
const CreateStory = lazy(() => import("./components/CreateStory"));
const Stories = lazy(() => import("./components/Stories"));

const Message = lazy(() => import("./components/Message"));
const Saved = lazy(() => import("./components/Saved"));

const Post = lazy(() => import("./components/Post"));
const Reel = lazy(() => import("./components/Reel"));
const Search = lazy(() => import("./components/Search"));


const PageLoader = () => {
  return (
    <div className="w-full h-screen flex justify-center items-center">
      <div className="loader"></div>
    </div>
  );
};

function App() {
  
  GetCurrentUser();

  const { userdata, loading, authChecked } = useSelector(
    (state) => state.user
  );

  
  if (loading && !authChecked) {
    return <PageLoader />;
  }

  return (
    <>
    
      {userdata && <GetSuggestedUsers />}

   
      <Suspense fallback={<PageLoader />}>
        <Routes>
       
          <Route
            path="/"
            element={
              userdata ? <Home /> : <Navigate to="/signin" replace />
            }
          />

        
          <Route
            path="/signup"
            element={
              !userdata ? <Signup /> : <Navigate to="/" replace />
            }
          />

          <Route
            path="/signin"
            element={
              !userdata ? <Signin /> : <Navigate to="/" replace />
            }
          />

          <Route
            path="/forgotpassword"
            element={
              !userdata ? (
                <Forgotpassword />
              ) : (
                <Navigate to="/" replace />
              )
            }
          />

          
          <Route path="/ai" element={<Aiimg />} />

      
          <Route path="/upload" element={<Upload />} />
          <Route path="/post/:id" element={<Post />} />

          
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/editprofile" element={<Editprofile />} />

        
          <Route path="/reels" element={<Reels />} />
          <Route path="/reel/:id" element={<Reel />} />

         
          <Route path="/create-story" element={<CreateStory />} />
          <Route path="/stories" element={<Stories />} />

        
          <Route path="/messages" element={<Message />} />

        
          <Route path="/saved" element={<Saved />} />

         
          <Route path="/search" element={<Search />} />

         
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
